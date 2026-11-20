/**
 * Vista que incrusta un micro frontend. Esta es la versión nativa (iOS/Android) con WebView,
 * configurada para comportarse como una pantalla nativa. La versión web está en EmbeddedView.web.tsx.
 */
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Linking } from 'react-native';
import { WebView, type WebViewProps } from 'react-native-webview';

// Los tipos de react-native-webview 14 declaran `WebView<P = undefined>`, que en modo estricto vuelve `never` sus props.
// Tipamos solo lo que usamos del componente y de su instancia.
interface WebViewInstance { injectJavaScript: (script: string) => void; reload: () => void }
const NativeWebView = WebView as unknown as React.ComponentType<WebViewProps & React.RefAttributes<WebViewInstance>>;

export interface EmbeddedHandle { send: (json: string) => void; reload: () => void }
export interface EmbeddedProps {
  url: string;
  /** Origen permitido (esquema + host + puerto). Cualquier otra navegación se abre fuera de la app. */
  origin: string;
  background: string;
  onMessage: (raw: string) => void;
  onLoadError: () => void;
}

export const EmbeddedView = forwardRef<EmbeddedHandle, EmbeddedProps>(function EmbeddedView({ url, origin, background, onMessage, onLoadError }, ref) {
  const web = useRef<WebViewInstance>(null);
  useImperativeHandle(ref, () => ({
    // Se entrega como string JSON escapado: el micro frontend lo valida antes de usarlo.
    send: (json) => web.current?.injectJavaScript(`window.__bancoPlusReceive && window.__bancoPlusReceive(${JSON.stringify(json)}); true;`),
    reload: () => web.current?.reload(),
  }), []);
  return (
    <NativeWebView
      ref={web}
      source={{ uri: url }}
      originWhitelist={[origin]}
      onShouldStartLoadWithRequest={(req) => {
        if (req.url.startsWith(origin)) return true;
        Linking.openURL(req.url).catch(() => {});
        return false;
      }}
      onMessage={(e) => { if (e.nativeEvent.url.startsWith(origin)) onMessage(e.nativeEvent.data); }}
      onError={onLoadError}
      onHttpError={(e) => { if (e.nativeEvent.statusCode >= 500 || e.nativeEvent.statusCode === 404) onLoadError(); }}
      onContentProcessDidTerminate={() => web.current?.reload()}
      onRenderProcessGone={() => web.current?.reload()}
      // Comportamiento nativo: sin rebote, sin zoom, sin barra de accesorios del teclado ni gestos del navegador.
      style={{ flex: 1, backgroundColor: background }}
      containerStyle={{ backgroundColor: background }}
      bounces={false}
      overScrollMode="never"
      scalesPageToFit={false}
      textZoom={100}
      setBuiltInZoomControls={false}
      allowsBackForwardNavigationGestures={false}
      allowsLinkPreview={false}
      hideKeyboardAccessoryView
      keyboardDisplayRequiresUserAction={false}
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
      setSupportMultipleWindows={false}
      javaScriptCanOpenWindowsAutomatically={false}
      allowFileAccess={false}
      mediaPlaybackRequiresUserAction
      sharedCookiesEnabled={false}
      cacheEnabled
      decelerationRate="normal"
      webviewDebuggingEnabled={__DEV__}
    />
  );
});
