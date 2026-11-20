/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { DOMAINS } from '../../shared/domain/commands';
import { BffStack } from '../lib/bff-stack';

const template = Template.fromStack(new BffStack(new App(), 'Test', { stage: 'prod', allowedOrigins: ['https://app.example.com'], env: { region: 'us-east-1' } }));

test('una Lambda por dominio más auth, me, cards-reveal y scheduler; Node 24 en ARM64 con X-Ray', () => {
  const fns = template.findResources('AWS::Lambda::Function', { Properties: { Runtime: 'nodejs24.x' } });
  assert.equal(Object.keys(fns).length, DOMAINS.length + 4);
  for (const f of Object.values(fns)) {
    assert.deepEqual(f.Properties.Architectures, ['arm64']);
    assert.deepEqual(f.Properties.TracingConfig, { Mode: 'Active' });
  }
});

test('todas las rutas exigen JWT de Cognito salvo login y refresh', () => {
  const routes = Object.values(template.findResources('AWS::ApiGatewayV2::Route')).map((r) => r.Properties);
  const publicRoutes = routes.filter((r) => r.AuthorizationType !== 'JWT').map((r) => r.RouteKey).sort();
  assert.deepEqual(publicRoutes, ['POST /v1/auth/login', 'POST /v1/auth/refresh']);
  assert.equal(routes.length, DOMAINS.length + 5);
  template.hasResourceProperties('AWS::ApiGatewayV2::Authorizer', { AuthorizerType: 'JWT', IdentitySource: ['$request.header.Authorization'] });
});

test('límites de tráfico, logs de acceso y CORS restringido', () => {
  template.hasResourceProperties('AWS::ApiGatewayV2::Stage', {
    DefaultRouteSettings: Match.objectLike({ ThrottlingRateLimit: 100, ThrottlingBurstLimit: 200 }),
    RouteSettings: Match.objectLike({
      'POST /v1/auth/login': { ThrottlingRateLimit: 10, ThrottlingBurstLimit: 20 },
      'POST /v1/cards/{cardId}/reveal': { ThrottlingRateLimit: 5, ThrottlingBurstLimit: 10 },
    }),
    AccessLogSettings: Match.objectLike({ DestinationArn: Match.anyValue() }),
  });
  template.hasResourceProperties('AWS::ApiGatewayV2::Api', { CorsConfiguration: Match.objectLike({ AllowOrigins: ['https://app.example.com'] }) });
});

test('DynamoDB con recuperación a un punto en el tiempo, TTL y protección en prod; Cognito sin autoregistro', () => {
  template.hasResourceProperties('AWS::DynamoDB::GlobalTable', {
    TimeToLiveSpecification: { AttributeName: 'expiresAt', Enabled: true },
    Replicas: [Match.objectLike({ DeletionProtectionEnabled: true, PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true } })],
  });
  template.hasResourceProperties('AWS::Cognito::UserPool', { AdminCreateUserConfig: { AllowAdminCreateUserOnly: true } });
  template.hasResourceProperties('AWS::Events::Rule', { ScheduleExpression: 'cron(0 10 * * ? *)' });
});
