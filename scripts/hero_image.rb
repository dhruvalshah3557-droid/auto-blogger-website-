#!/usr/bin/env ruby
# Generates a branded ColourDiam hero image as JPG (1600x900) from an article title.
# Usage: ruby scripts/hero_image.rb "Article Title" /path/to/output.jpg

require 'victor'

ABORT_MSG = 'USAGE: ruby scripts/hero_image.rb "Article Title" /path/to/output.jpg'

title = ARGV[0]
out   = ARGV[1]

abort ABORT_MSG if title.nil? || out.nil?

def build_svg(title)
  svg = Victor::SVG.new width: 1600, height: 900, viewBox: '0 0 1600 900'
  svg.build do
    rect x: 0, y: 0, width: 1600, height: 900, fill: '#011b32'
    rect x: 0, y: 620, width: 1600, height: 280, fill: '#0a2f52'
    polygon points: '800,180 1000,520 800,860 600,520', fill: '#dbb6b6', opacity: 0.9
    polygon points: '800,180 1000,520 800,860', fill: '#e8cfcf'
    polygon points: '800,180 600,520 800,860', fill: '#c99e9e'
    circle cx: 800, cy: 520, r: 120, fill: '#fff', opacity: 0.9
    text x: 800, y: 300, font_family: 'Georgia, serif', font_size: 60,
         fill: '#ffffff', text_anchor: 'middle', font_weight: 'bold' do
      tspan title
    end
    text x: 800, y: 640, font_family: 'Arial, sans-serif', font_size: 28,
         fill: '#a9c4dd', text_anchor: 'middle' do
      tspan 'ColourDiam | Natural Fancy Colour Diamonds'
    end
  end
  svg
end

svg = build_svg(title)
svg.save('/tmp/colourdiam_hero.svg')
system('convert', '/tmp/colourdiam_hero.svg', '-background', '#011b32', '-resize', '1600x900', out)

unless File.exist?(out)
  warn "Failed to render JPG: #{out}"
  exit 1
end

puts "Hero image written to #{out}"
