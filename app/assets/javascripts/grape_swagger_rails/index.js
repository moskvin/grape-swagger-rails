"use strict";
function initializeSwaggerPage() {
    var optionsElement = document.documentElement.dataset.swaggerOptions;
    if (!optionsElement ||
        typeof SwaggerUIBundle === "undefined" ||
        typeof SwaggerUIStandalonePreset === "undefined") {
        return;
    }
    var options = JSON.parse(optionsElement);
    var authInput = document.getElementById("input_apiKey");
    var themeToggle = document.getElementById("theme-toggle");
    var root = document.documentElement;
    function getTheme() {
        return options.theme === "dark" ? "dark" : "light";
    }
    function applyTheme(theme) {
        root.dataset.theme = theme;
        root.classList.toggle("dark-mode", theme === "dark");
        if (!themeToggle) {
            return;
        }
        themeToggle.textContent = theme === "dark" ? "Light Mode" : "Dark Mode";
        themeToggle.setAttribute("aria-pressed", String(theme === "dark"));
    }
    function getApiKeyValue() {
        if (!authInput) {
            return "";
        }
        var key = authInput.value ? authInput.value.trim() : "";
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
            return "Token token=\"".concat(key, "\"");
        }
        return key;
    }
    function ensureRequestHeaders(request) {
        if (!request.headers) {
            request.headers = {};
        }
        return request.headers;
    }
    function setRequestHeader(request, key, value) {
        var headers = ensureRequestHeaders(request);
        if (headers instanceof Headers) {
            headers.set(key, value);
            return;
        }
        headers[key] = value;
    }
    applyTheme(getTheme());
    if (themeToggle) {
        themeToggle.addEventListener("click", function () {
            options.theme = root.dataset.theme === "dark" ? "light" : "dark";
            applyTheme(options.theme);
        });
    }
    var specUrl = options.app_url ? options.app_url + options.url : options.url;
    window.ui = SwaggerUIBundle({
        url: specUrl,
        dom_id: "#swagger-ui-container",
        deepLinking: true,
        docExpansion: options.doc_expansion,
        supportedSubmitMethods: options.supported_submit_methods || [],
        validatorUrl: options.validator_url,
        layout: "BaseLayout",
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        requestInterceptor: function (request) {
            var headers = options.headers || {};
            Object.keys(headers).forEach(function (key) {
                setRequestHeader(request, key, headers[key]);
            });
            var apiKeyValue = getApiKeyValue();
            if (!apiKeyValue) {
                return request;
            }
            if (options.api_key_type === "query") {
                var separator = request.url.indexOf("?") === -1 ? "?" : "&";
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
    });
}
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeSwaggerPage);
}
else {
    initializeSwaggerPage();
}
