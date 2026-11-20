// El micro frontend (mfe/) es una app Next.js independiente: Metro no debe indexarla.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
const mfe = path.resolve(__dirname, 'mfe').replace(/[/\\]/g, '[/\\\\]');
config.resolver.blockList = [new RegExp(`${mfe}[/\\\\].*`)];
module.exports = config;
