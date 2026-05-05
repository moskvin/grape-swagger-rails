interface Window {
  ui: any;
}

interface SwaggerPageOptions {
  api_auth: string;
  api_key_name: string;
  api_key_type: string;
  api_key_default_value: string;
  api_key_placeholder: string;
  app_name: string;
  app_url: string;
  doc_expansion: string;
  headers: Record<string, string>;
  hide_api_key_input: boolean;
  hide_url_input: boolean;
  supported_submit_methods: string[];
  theme: string;
  url: string;
  validator_url: string | null | undefined;
  swagger_ui_config?: Record<string, unknown>;
}

interface SwaggerRequest {
  url: string;
  headers?: Record<string, string> | Headers;
}

declare const SwaggerUIBundle: any;
declare const SwaggerUIStandalonePreset: any;

function initializeSwaggerPage(): void {
  const optionsElement = document.documentElement.dataset.swaggerOptions;
  if (
    !optionsElement ||
    typeof SwaggerUIBundle === "undefined" ||
    typeof SwaggerUIStandalonePreset === "undefined"
  ) {
    return;
  }

  const options: SwaggerPageOptions = JSON.parse(optionsElement);
  const authInput = document.getElementById("input_apiKey") as HTMLInputElement | null;
  const themeToggle = document.getElementById("theme-toggle") as HTMLButtonElement | null;
  const root = document.documentElement;

  function getTheme(): string {
    return options.theme === "dark" ? "dark" : "light";
  }

  function applyTheme(theme: string): void {
    root.dataset.theme = theme;
    root.classList.toggle("dark-mode", theme === "dark");

    if (!themeToggle) {
      return;
    }

    themeToggle.textContent = theme === "dark" ? "Light Mode" : "Dark Mode";
    themeToggle.setAttribute("aria-pressed", String(theme === "dark"));
  }

  function getApiKeyValue(): string {
    if (!authInput) {
      return "";
    }

    const key = authInput.value ? authInput.value.trim() : "";

    if (!key) {
      return "";
    }

    if (options.api_auth === "basic") {
      return "Basic " + btoa(key);
    }

    if (options.api_auth === "bearer") {
      return "Bearer " + key;
    }

    if (options.api_auth === "token") {
      return `Token token="${key}"`;
    }

    return key;
  }

  function ensureRequestHeaders(request: SwaggerRequest): Record<string, string> | Headers {
    if (!request.headers) {
      request.headers = {};
    }

    return request.headers as Record<string, string> | Headers;
  }

  function setRequestHeader(request: SwaggerRequest, key: string, value: string): void {
    const headers = ensureRequestHeaders(request);

    if (headers instanceof Headers) {
      headers.set(key, value);
      return;
    }

    (headers as Record<string, string>)[key] = value;
  }

  applyTheme(getTheme());

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      options.theme = root.dataset.theme === "dark" ? "light" : "dark";
      applyTheme(options.theme);
    });
  }

  const specUrl = options.app_url ? options.app_url + options.url : options.url;

  window.ui = SwaggerUIBundle(Object.assign({}, options.swagger_ui_config || {}, {
    url: specUrl,
    dom_id: "#swagger-ui-container",
    deepLinking: true,
    docExpansion: options.doc_expansion,
    supportedSubmitMethods: options.supported_submit_methods || [],
    validatorUrl: options.validator_url,
    layout: "BaseLayout",
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
    requestInterceptor: (request: SwaggerRequest) => {
      const headers = options.headers || {};
      Object.keys(headers).forEach((key) => {
        setRequestHeader(request, key, headers[key]);
      });

      const apiKeyValue = getApiKeyValue();
      if (!apiKeyValue) {
        return request;
      }

      if (options.api_key_type === "query") {
        const separator = request.url.indexOf("?") === -1 ? "?" : "&";
        request.url +=
          separator +
          encodeURIComponent(options.api_key_name) +
          "=" +
          encodeURIComponent(apiKeyValue);
        return request;
      }

      setRequestHeader(request, options.api_key_name, apiKeyValue);
      return request;
    },
  }));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeSwaggerPage);
} else {
  initializeSwaggerPage();
}
