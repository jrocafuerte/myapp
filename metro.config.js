// mfe/ (Next.js) y bff/ (AWS CDK + Lambdas) son proyectos independientes: Metro no debe indexarlos.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
const dir = (name) => new RegExp(`${path.resolve(__dirname, name).replace(/[/\\]/g, '[/\\\\]')}[/\\\\].*`);
config.resolver.blockList = [dir('mfe'), dir('bff')];
module.exports = config;
