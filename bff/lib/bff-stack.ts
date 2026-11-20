/**
 * Infraestructura del BFF (serverless):
 *   API Gateway HTTP API ─ autorizador JWT (Cognito) ─ Lambdas Node.js 24 (ARM64) ─ DynamoDB
 *   + Cognito User Pool, EventBridge diario, logs de acceso, X-Ray y límites de tráfico.
 */
import * as path from 'node:path';
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { AccessLogFormat } from 'aws-cdk-lib/aws-apigateway';
import { CfnStage, CorsHttpMethod, HttpApi, HttpMethod, HttpStage, LogGroupLogDestination } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { AccountRecovery, Mfa, UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito';
import { AttributeType, Billing, TableEncryptionV2, TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { Architecture, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import type { Construct } from 'constructs';
import { DOMAINS } from '../../shared/domain/commands';

export interface BffStackProps extends StackProps {
  stage: 'dev' | 'prod';
  /** Orígenes de la app web autorizados por CORS (iOS/Android no usan CORS). */
  allowedOrigins: string[];
}

const ROOT = path.join(__dirname, '..', '..');
const LOCKFILE = path.join(__dirname, '..', 'package-lock.json');

export class BffStack extends Stack {
  constructor(scope: Construct, id: string, props: BffStackProps) {
    super(scope, id, props);
    const prod = props.stage === 'prod';

    /* ------------------------------- datos ------------------------------- */
    const table = new TableV2(this, 'Table', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      billing: Billing.onDemand(),
      timeToLiveAttribute: 'expiresAt',
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      encryption: TableEncryptionV2.awsManagedKey(),
      deletionProtection: prod,
      removalPolicy: prod ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    /* ----------------------------- identidad ----------------------------- */
    const userPool = new UserPool(this, 'Users', {
      selfSignUpEnabled: false, // el alta de clientes la hace el banco
      signInAliases: { username: true, email: true },
      passwordPolicy: { minLength: 8, requireDigits: true, requireLowercase: true, requireUppercase: false, requireSymbols: false },
      mfa: Mfa.OPTIONAL,
      mfaSecondFactor: { otp: true, sms: false },
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      removalPolicy: prod ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      deletionProtection: prod,
    });
    const client = new UserPoolClient(this, 'AppClient', {
      userPool,
      authFlows: { userPassword: true, userSrp: true },
      generateSecret: false,
      preventUserExistenceErrors: true,
      accessTokenValidity: Duration.minutes(15),
      idTokenValidity: Duration.minutes(15),
      refreshTokenValidity: Duration.days(30),
      enableTokenRevocation: true,
    });

    /* ------------------------------ Lambdas ------------------------------ */
    const fn = (name: string, entry: string, env: Record<string, string> = {}) => new NodejsFunction(this, name, {
      entry: path.join(__dirname, '..', 'src', 'handlers', entry),
      handler: 'handler',
      projectRoot: ROOT,
      depsLockFilePath: LOCKFILE,
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      memorySize: 512,
      timeout: Duration.seconds(10),
      tracing: Tracing.ACTIVE,
      logGroup: new LogGroup(this, `${name}Logs`, { retention: prod ? RetentionDays.ONE_YEAR : RetentionDays.ONE_MONTH, removalPolicy: RemovalPolicy.DESTROY }),
      environment: { TABLE_NAME: table.tableName, USER_POOL_CLIENT_ID: client.userPoolClientId, NODE_OPTIONS: '--enable-source-maps', ...env },
      bundling: { minify: true, sourceMap: true, target: 'node24', format: OutputFormat.CJS, externalModules: ['@aws-sdk/*'] },
    });

    const auth = fn('Auth', 'auth.ts');
    const me = fn('Me', 'me.ts');
    const reveal = fn('CardsReveal', 'cardsReveal.ts');
    const scheduler = fn('Scheduler', 'scheduler.ts', { SCHEDULER: '1' });
    const domainFns = Object.fromEntries(DOMAINS.map((d) => [d, fn(`Commands${d[0].toUpperCase()}${d.slice(1)}`, 'commands.ts', { DOMAIN: d })]));

    // Mínimo privilegio: solo lo que cada función necesita.
    for (const f of [me, reveal, scheduler, ...Object.values(domainFns)]) table.grantReadWriteData(f);
    new Rule(this, 'Daily', { schedule: Schedule.cron({ minute: '0', hour: '10' }), targets: [new LambdaFunction(scheduler)] }); // 05:00 hora de Ecuador/Colombia/Perú

    /* -------------------------------- API -------------------------------- */
    const api = new HttpApi(this, 'Api', {
      createDefaultStage: false,
      corsPreflight: {
        allowOrigins: props.allowedOrigins,
        allowHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'],
        allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST],
        maxAge: Duration.hours(1),
      },
    });
    const accessLogs = new LogGroup(this, 'AccessLogs', { retention: prod ? RetentionDays.ONE_YEAR : RetentionDays.ONE_MONTH, removalPolicy: RemovalPolicy.DESTROY });
    const stage = new HttpStage(this, 'Stage', {
      httpApi: api,
      stageName: '$default',
      autoDeploy: true,
      throttle: { rateLimit: 100, burstLimit: 200 },
      accessLogSettings: { destination: new LogGroupLogDestination(accessLogs), format: AccessLogFormat.custom(JSON.stringify({
        requestId: '$context.requestId', routeKey: '$context.routeKey', status: '$context.status', latency: '$context.responseLatency',
        integrationError: '$context.integrationErrorMessage', authorizerError: '$context.authorizer.error',
      })) },
    });
    // Límites más estrictos en rutas sensibles (fuerza bruta de credenciales y de OTP).
    // routeSettings es JSON de CloudFormation sin conversión: las claves van en PascalCase.
    (stage.node.defaultChild as CfnStage).routeSettings = {
      'POST /v1/auth/login': { ThrottlingRateLimit: 10, ThrottlingBurstLimit: 20 },
      'POST /v1/cards/{cardId}/reveal': { ThrottlingRateLimit: 5, ThrottlingBurstLimit: 10 },
    };

    const authorizer = new HttpJwtAuthorizer('Cognito', `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`, {
      jwtAudience: [client.userPoolClientId],
      identitySource: ['$request.header.Authorization'],
    });
    // Los access token de Cognito no traen `aud`: el autorizador valida `client_id` contra jwtAudience.
    const integ = (name: string, f: NodejsFunction) => new HttpLambdaIntegration(name, f);

    api.addRoutes({ path: '/v1/auth/login', methods: [HttpMethod.POST], integration: integ('LoginInt', auth) });
    api.addRoutes({ path: '/v1/auth/refresh', methods: [HttpMethod.POST], integration: integ('RefreshInt', auth) });
    api.addRoutes({ path: '/v1/auth/password', methods: [HttpMethod.POST], integration: integ('PasswordInt', auth), authorizer });
    api.addRoutes({ path: '/v1/me', methods: [HttpMethod.GET], integration: integ('MeInt', me), authorizer });
    api.addRoutes({ path: '/v1/cards/{cardId}/reveal', methods: [HttpMethod.POST], integration: integ('RevealInt', reveal), authorizer });
    for (const [domain, f] of Object.entries(domainFns)) {
      api.addRoutes({ path: `/v1/${domain}/commands`, methods: [HttpMethod.POST], integration: integ(`${domain}Int`, f), authorizer });
    }

    new CfnOutput(this, 'ApiUrl', { value: api.apiEndpoint, description: 'Para EXPO_PUBLIC_BFF_URL en la app' });
    new CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new CfnOutput(this, 'UserPoolClientId', { value: client.userPoolClientId });
    new CfnOutput(this, 'TableName', { value: table.tableName });
  }
}
