# frozen_string_literal: true

require 'spec_helper'

describe 'Welcome' do
  before do
    visit '/'
  end

  it 'renders a link to swagger' do
    expect(page).to have_link(href: '/swagger')
  end
end
