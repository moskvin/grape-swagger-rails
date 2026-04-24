# frozen_string_literal: true

require 'fileutils'
require 'git'
require 'tmpdir'

namespace :swagger_ui do
  namespace :dist do
    desc 'Update Swagger UI assets from swagger-api/swagger-ui.'
    task :update do
      version = ENV.fetch('SWAGGER_UI_VERSION', 'v5.32.4')

      Dir.mktmpdir('swagger-ui') do |dir|
        puts "Cloning swagger-api/swagger-ui #{version} into #{dir} ..."
        Git.clone(
          'https://github.com/swagger-api/swagger-ui.git',
          'swagger-ui',
          path: dir,
          depth: 1,
          branch: version
        )

        root = File.expand_path('../..', __dir__)
        dist = File.join(dir, 'swagger-ui', 'dist')

        unless Dir.exist?(dist)
          raise "Missing dist directory at #{dist}"
        end

        puts 'Copying JavaScript assets ...'
        {
          'swagger-ui-bundle.js' => File.join(root, 'app/assets/javascripts/grape_swagger_rails/swagger-ui-bundle.js'),
          'swagger-ui-standalone-preset.js' => File.join(root, 'app/assets/javascripts/grape_swagger_rails/swagger-ui-standalone-preset.js')
        }.each do |source_name, target|
          FileUtils.cp File.join(dist, source_name), target
        end

        puts 'Copying stylesheet assets ...'
        FileUtils.cp File.join(dist, 'swagger-ui.css'),
                     File.join(root, 'app/assets/stylesheets/grape_swagger_rails/swagger-ui.css')
      end
    end
  end
end
