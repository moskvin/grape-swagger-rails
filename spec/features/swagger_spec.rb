# frozen_string_literal: true

require 'spec_helper'

describe 'Swagger' do
  def visit_swagger
    visit '/swagger'
    expect(page).to have_css('.swagger-ui')
  end

  def swagger_options_data
    page.evaluate_script('JSON.parse(document.documentElement.dataset.swaggerOptions)')
  end

  def swagger_configs
    page.evaluate_script(<<~JS)
      (function() {
        var configs = window.ui.getConfigs();

        return {
          docExpansion: configs.docExpansion,
          supportedSubmitMethods: configs.supportedSubmitMethods,
          validatorUrl: configs.validatorUrl,
          validatorType: typeof configs.validatorUrl,
          url: configs.url
        };
      })()
    JS
  end

  def theme_state
    page.evaluate_script(<<~JS)
      (function() {
        var toggle = document.getElementById('theme-toggle');

        return {
          theme: document.documentElement.dataset.theme,
          buttonLabel: toggle && toggle.textContent,
          pressed: toggle && toggle.getAttribute('aria-pressed')
        };
      })()
    JS
  end

  def intercepted_request(url)
    page.evaluate_script(<<~JS, url)
      (function(requestUrl) {
        var request = { url: requestUrl, headers: {} };
        return window.ui.getConfigs().requestInterceptor(request);
      })(arguments[0])
    JS
  end

  def set_api_key(value)
    find_by_id('input_apiKey').set(value)
  end

  it "uses grape-swagger=#{GrapeSwagger::VERSION} grape-swagger-rails=#{GrapeSwaggerRails::VERSION}" do
    expect(GrapeSwagger::VERSION).not_to be_blank
    expect(GrapeSwaggerRails::VERSION).not_to be_blank
  end

  context 'swaggerUi' do
    before do
      visit_swagger
    end

    it 'loads foos resource' do
      expect(page).to have_text('foos')
    end

    it 'loads Swagger UI' do
      expect(page.evaluate_script('typeof window.ui')).to eq 'object'
    end
  end

  describe '#options' do
    before do
      @options = GrapeSwaggerRails.options.dup
    end

    after do
      GrapeSwaggerRails.options = @options
    end

    it 'evaluates config options correctly' do
      visit_swagger
      page_options = swagger_options_data.symbolize_keys
      expect(page_options).to eq(@options.marshal_dump)
    end

    describe '#headers' do
      before do
        GrapeSwaggerRails.options.headers['X-Test-Header'] = 'Test Value'
        GrapeSwaggerRails.options.headers['X-Another-Header'] = 'Another Value'
        visit_swagger
      end

      it 'adds headers' do
        request = intercepted_request('http://localhost:3000/api/headers')

        expect(request.fetch('headers')).to include(
          'X-Test-Header' => 'Test Value',
          'X-Another-Header' => 'Another Value'
        )
      end

      it 'supports multiple headers' do
        request = intercepted_request('http://localhost:3000/api/headers')

        expect(request.fetch('headers').keys).to include('X-Test-Header', 'X-Another-Header')
      end
    end

    describe '#api_key_default_value' do
      before do
        GrapeSwaggerRails.options.api_auth = 'bearer'
        GrapeSwaggerRails.options.api_key_name = 'Authorization'
        GrapeSwaggerRails.options.api_key_type = 'header'
        GrapeSwaggerRails.options.api_key_default_value = 'token'
        visit_swagger
      end

      it 'adds an Authorization header' do
        request = intercepted_request('http://localhost:3000/api/headers')

        expect(request.fetch('headers')).to include('Authorization' => 'Bearer token')
      end
    end

    describe '#api_key_placeholder' do
      before do
        GrapeSwaggerRails.options.api_key_placeholder = 'authorization_code'
        visit_swagger
      end

      it 'adds a custom placeholder' do
        expect(find_by_id('input_apiKey')['placeholder']).to eq 'authorization_code'
      end
    end

    describe '#api_auth:basic' do
      before do
        GrapeSwaggerRails.options.api_auth = 'basic'
        GrapeSwaggerRails.options.api_key_name = 'Authorization'
        GrapeSwaggerRails.options.api_key_type = 'header'
        visit_swagger
      end

      it 'adds an Authorization header' do
        set_api_key('username:password')

        request = intercepted_request('http://localhost:3000/api/headers')

        expect(request.fetch('headers')).to include(
          'Authorization' => "Basic #{Base64.encode64('username:password').strip}"
        )
      end
    end

    describe '#api_auth:bearer' do
      before do
        GrapeSwaggerRails.options.api_auth = 'bearer'
        GrapeSwaggerRails.options.api_key_name = 'Authorization'
        GrapeSwaggerRails.options.api_key_type = 'header'
        visit_swagger
      end

      it 'adds an Authorization header' do
        set_api_key('token')

        request = intercepted_request('http://localhost:3000/api/headers')

        expect(request.fetch('headers')).to include('Authorization' => 'Bearer token')
      end
    end

    describe '#api_auth:token and #api_key_type:header' do
      before do
        GrapeSwaggerRails.options.api_auth = 'token'
        GrapeSwaggerRails.options.api_key_name = 'Authorization'
        GrapeSwaggerRails.options.api_key_type = 'header'
        visit_swagger
      end

      it 'adds an Authorization header' do
        set_api_key('token')

        request = intercepted_request('http://localhost:3000/api/headers')

        expect(request.fetch('headers')).to include('Authorization' => 'Token token="token"')
      end
    end

    describe '#api_auth:token' do
      before do
        GrapeSwaggerRails.options.api_key_name = 'api_token'
        GrapeSwaggerRails.options.api_key_type = 'query'
        visit_swagger
      end

      it 'adds an api_token query parameter' do
        set_api_key('dummy')

        request = intercepted_request('http://localhost:3000/api/params')

        expect(request.fetch('url')).to eq 'http://localhost:3000/api/params?api_token=dummy'
      end
    end

    describe '#before_filter' do
      before do
        allow(GrapeSwaggerRails.deprecator).to receive(:warn)
      end

      it 'throws deprecation warning' do
        GrapeSwaggerRails.options.before_filter { true }

        expect(GrapeSwaggerRails.deprecator).to have_received(:warn).with(
          'This option is deprecated and going to be removed in 1.0.0. ' \
          'Please use `before_action` instead'
        )
      end
    end

    describe '#before_action' do
      before do
        GrapeSwaggerRails.options.before_action do |_request|
          flash[:error] = 'Unauthorized Access'
          redirect_to '/'
          false
        end
        visit '/swagger'
      end

      it 'denies access' do
        expect(page).to have_current_path '/', ignore_query: true
        expect(page).to have_content 'Unauthorized Access'
      end
    end

    describe '#app_name' do
      context 'set' do
        before do
          GrapeSwaggerRails.options.app_name = 'Test App'
          visit_swagger
        end

        it 'sets page title' do
          expect(page.title).to eq 'Test App'
        end
      end

      context 'not set' do
        before do
          visit_swagger
        end

        it 'defaults page title' do
          expect(page.title).to eq 'Swagger'
        end
      end
    end

    describe '#theme' do
      context 'not set' do
        before do
          visit_swagger
        end

        it 'defaults to light mode' do
          expect(theme_state).to include(
            'theme' => 'light',
            'buttonLabel' => 'Dark Mode',
            'pressed' => 'false'
          )
        end
      end

      context 'set dark' do
        before do
          GrapeSwaggerRails.options.theme = 'dark'
          visit_swagger
        end

        it 'uses dark mode on load' do
          expect(theme_state).to include(
            'theme' => 'dark',
            'buttonLabel' => 'Light Mode',
            'pressed' => 'true'
          )
        end

        it 'switches back to light mode' do
          click_button 'Light Mode'

          expect(theme_state).to include(
            'theme' => 'light',
            'buttonLabel' => 'Dark Mode',
            'pressed' => 'false'
          )
        end
      end
    end

    describe '#doc_expansion' do
      context 'set list' do
        before do
          GrapeSwaggerRails.options.doc_expansion = 'list'
          visit_swagger
        end

        it 'sets SwaggerUI docExpansion with list' do
          expect(swagger_configs.fetch('docExpansion')).to eq 'list'
        end
      end

      context 'set full' do
        before do
          GrapeSwaggerRails.options.doc_expansion = 'full'
          visit_swagger
        end

        it 'sets SwaggerUI docExpansion with full' do
          expect(swagger_configs.fetch('docExpansion')).to eq 'full'
        end
      end

      context 'not set' do
        before do
          visit_swagger
        end

        it 'defaults SwaggerUI docExpansion' do
          expect(swagger_configs.fetch('docExpansion')).to eq 'none'
        end
      end
    end

    describe '#supported_submit_methods' do
      context 'set all operations' do
        before do
          GrapeSwaggerRails.options.supported_submit_methods = %w[get post put delete patch]
          visit_swagger
        end

        it 'sets SwaggerUI supportedSubmitMethods with all operations' do
          expect(swagger_configs.fetch('supportedSubmitMethods')).to eq %w[get post put delete patch]
        end
      end

      context 'set some operations' do
        before do
          GrapeSwaggerRails.options.supported_submit_methods = ['post']
          visit_swagger
        end

        it 'sets SwaggerUI supportedSubmitMethods with some operations' do
          expect(swagger_configs.fetch('supportedSubmitMethods')).to eq ['post']
        end
      end

      context 'set nil' do
        before do
          GrapeSwaggerRails.options.supported_submit_methods = nil
          visit_swagger
        end

        it 'clears SwaggerUI supportedSubmitMethods' do
          expect(swagger_configs.fetch('supportedSubmitMethods')).to eq []
        end
      end

      context 'not set' do
        before do
          visit_swagger
        end

        it 'defaults SwaggerUI supportedSubmitMethods' do
          expect(swagger_configs.fetch('supportedSubmitMethods')).to eq %w[get post put delete patch]
        end
      end
    end

    describe '#validator_url' do
      context 'set null' do
        before do
          GrapeSwaggerRails.options.validator_url = nil
          visit_swagger
        end

        it 'sets SwaggerUI validatorUrl to null' do
          expect(swagger_configs.fetch('validatorUrl')).to be_nil
          expect(swagger_configs.fetch('validatorType')).to eq 'object'
        end
      end

      context 'set a url' do
        before do
          GrapeSwaggerRails.options.validator_url = 'http://www.example.com/'
          visit_swagger
        end

        it 'sets SwaggerUI validatorUrl to expected url' do
          expect(swagger_configs.fetch('validatorUrl')).to eq 'http://www.example.com/'
        end
      end

      context 'not set' do
        before do
          visit_swagger
        end

        it 'defaults SwaggerUI validatorUrl' do
          expect(swagger_configs.fetch('validatorUrl')).to eq 'undefined'
          expect(swagger_configs.fetch('validatorType')).to eq 'string'
        end
      end
    end
  end
end
