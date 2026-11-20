#!/usr/bin/env node
/**
 *   npx cdk deploy -c stage=dev -c allowedOrigins=https://app.tu-dominio.com
 * Cuenta y región: las del perfil de AWS activo (o CDK_DEFAULT_ACCOUNT / CDK_DEFAULT_REGION).
 */
import { App, Tags } from 'aws-cdk-lib';
import { BffStack } from '../lib/bff-stack';

const app = new App();
const stage = (app.node.tryGetContext('stage') ?? 'dev') as 'dev' | 'prod';
const allowedOrigins = String(app.node.tryGetContext('allowedOrigins') ?? 'http://localhost:8081').split(',').map((o) => o.trim()).filter(Boolean);
const stack = new BffStack(app, `BancoPlusBff-${stage}`, {
  stage, allowedOrigins,
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1' },
});
Tags.of(stack).add('app', 'banco-plus');
Tags.of(stack).add('stage', stage);
