source 'https://rubygems.org'

ruby '3.2.11'

# Rails 8 standard stack. The task UI will use Turbo and browser-local storage.
gem 'rails', '~> 8.0', '>= 8.0.5.1'
gem 'sqlite3', '>= 2.1'
gem 'puma', '>= 6.0'
gem 'propshaft'
gem 'importmap-rails'
gem 'turbo-rails'
gem 'stimulus-rails'
gem 'jbuilder'
gem 'bcrypt', '~> 3.1'
gem 'bootsnap', require: false
gem 'slim-rails'

group :development, :test do
  gem 'debug', platforms: %i[mri mingw x64_mingw]
  gem 'rspec-rails', '~> 8.0'
  gem 'factory_bot_rails'
end

group :development do
  gem 'web-console'
end

group :test do
  gem 'capybara'
  gem 'selenium-webdriver'
end

gem 'tzinfo-data', platforms: %i[mingw mswin x64_mingw jruby]
