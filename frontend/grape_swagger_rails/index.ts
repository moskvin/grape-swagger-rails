interface SwaggerPageOptions {
  api_auth: string;
  api_key_name: string;
  api_key_type: string;
  app_url: string;
  doc_expansion: string;
  headers: Record<string, string>;
  supported_submit_methods?: string[] | null;
  theme: string;
  url: string;
  urls: Array<string | SwaggerUrlOption> | null;
  urls_primary_name: string;
  validator_url: string | null;
  swagger_ui_config?: Record<string, unknown>;
}

interface SwaggerUrlOption {
  name?: string;
  url: string;
}

interface NormalizedSwaggerUrl {
  name: string;
  url: string;
}

interface SwaggerRequest {
  headers?: Headers | Record<string, string>;
  url: string;
}

interface SwaggerUIConfig {
  [key: string]: unknown;
  "urls.primaryName"?: string;
  deepLinking?: boolean;
  docExpansion?: string;
  dom_id?: string;
  layout?: string;
  presets?: unknown[];
  requestInterceptor?: (request: SwaggerRequest) => SwaggerRequest;
  supportedSubmitMethods?: string[];
  url?: string;
  urls?: Array<{ name: string; url: string }>;
  validatorUrl?: string | null;
}

interface SwaggerUISpecActions {
  download(url: string): void;
  updateUrl(url: string): void;
}

interface SwaggerUIInstance {
  specActions: SwaggerUISpecActions;
}

interface SwaggerUIBundleStatic {
  (config: SwaggerUIConfig): SwaggerUIInstance;
  presets: {
    apis: unknown;
  };
}

declare const SwaggerUIBundle: SwaggerUIBundleStatic;
declare const SwaggerUIStandalonePreset: unknown;
interface Window {
  ui: SwaggerUIInstance;
}

(() => {
  function initializeSwaggerPage(): void {
    const optionsElement = document.documentElement.dataset.swaggerOptions;
    if (!optionsElement || typeof SwaggerUIBundle === "undefined" || typeof SwaggerUIStandalonePreset === "undefined") {
      return;
    }

    const options = JSON.parse(optionsElement) as SwaggerPageOptions;
    const authInput = document.getElementById("input_apiKey") as HTMLInputElement | null;
    const specSelector = document.getElementById("spec-selector") as HTMLSelectElement | null;
    const specSelectorWrapper = document.getElementById("spec-selector-wrapper") as HTMLLabelElement | null;
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
        return "Token token=\"" + key + "\"";
      }

      return key;
    }

    function absoluteSpecUrl(url: string): string {
      if (!url) {
        return "";
      }

      if (/^https?:\/\//.test(url)) {
        return url;
      }

      return options.app_url + url;
    }

    function normalizeSwaggerUrls(): NormalizedSwaggerUrl[] {
      if (!Array.isArray(options.urls)) {
        return [];
      }

      return options.urls
        .map((entry, index): NormalizedSwaggerUrl => {
          if (typeof entry === "string") {
            return {
              name: entry,
              url: absoluteSpecUrl(entry)
            };
          }

          return {
            name: entry.name || entry.url || "Spec " + (index + 1),
            url: absoluteSpecUrl(entry.url)
          };
        })
        .filter((entry) => Boolean(entry.url));
    }

    function selectedSwaggerUrl(urls: NormalizedSwaggerUrl[]): NormalizedSwaggerUrl | null {
      if (!urls.length) {
        return null;
      }

      if (options.urls_primary_name) {
        for (let i = 0; i < urls.length; i += 1) {
          if (urls[i].name === options.urls_primary_name) {
            return urls[i];
          }
        }
      }

      if (options.url) {
        const absoluteUrl = absoluteSpecUrl(options.url);

        for (let j = 0; j < urls.length; j += 1) {
          if (urls[j].url === absoluteUrl) {
            return urls[j];
          }
        }
      }

      return urls[0];
    }

    function setupSpecSelector(urls: NormalizedSwaggerUrl[], selectedUrl: NormalizedSwaggerUrl | null): void {
      if (!specSelector || !specSelectorWrapper || urls.length < 2) {
        return;
      }

      urls.forEach((entry) => {
        const option = document.createElement("option");
        option.value = entry.url;
        option.textContent = entry.name;

        if (selectedUrl && entry.url === selectedUrl.url) {
          option.selected = true;
        }

        specSelector.appendChild(option);
      });

      specSelectorWrapper.hidden = false;
    }

    function ensureRequestHeaders(request: SwaggerRequest): Headers | Record<string, string> {
      if (!request.headers) {
        request.headers = {};
      }

      return request.headers;
    }

    function setRequestHeader(request: SwaggerRequest, key: string, value: string): void {
      const headers = ensureRequestHeaders(request);

      if (headers instanceof Headers) {
        headers.set(key, value);
        return;
      }

      headers[key] = value;
    }

    applyTheme(getTheme());

    const swaggerUrls = normalizeSwaggerUrls();
    const selectedUrl = selectedSwaggerUrl(swaggerUrls);

    if (themeToggle) {
      themeToggle.addEventListener("click", () => {
        options.theme = root.dataset.theme === "dark" ? "light" : "dark";
        applyTheme(options.theme);
      });
    }

    const swaggerUiConfig: SwaggerUIConfig = Object.assign({}, options.swagger_ui_config || {}, {
      dom_id: "#swagger-ui-container",
      deepLinking: true,
      docExpansion: options.doc_expansion,
      supportedSubmitMethods: options.supported_submit_methods || [],
      validatorUrl: options.validator_url,
      layout: "BaseLayout",
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
      requestInterceptor(request: SwaggerRequest): SwaggerRequest {
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
          request.url += separator + encodeURIComponent(options.api_key_name) + "=" + encodeURIComponent(apiKeyValue);
          return request;
        }

        setRequestHeader(request, options.api_key_name, apiKeyValue);
        return request;
      }
    });

    if (swaggerUrls.length) {
      swaggerUiConfig.urls = swaggerUrls.map((entry) => {
        return {
          name: entry.name,
          url: entry.url
        };
      });

      if (selectedUrl) {
        swaggerUiConfig["urls.primaryName"] = selectedUrl.name;
      }
    } else {
      swaggerUiConfig.url = absoluteSpecUrl(options.url);
    }

    window.ui = SwaggerUIBundle(swaggerUiConfig);

    setupSpecSelector(swaggerUrls, selectedUrl);

    if (specSelector && swaggerUrls.length > 1) {
      specSelector.addEventListener("change", (event) => {
        const target = event.target as HTMLSelectElement;
        const url = target.value;
        window.ui.specActions.updateUrl(url);
        window.ui.specActions.download(url);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeSwaggerPage);
  } else {
    initializeSwaggerPage();
  }
})();
