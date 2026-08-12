#!/bin/bash

echo "📁 Creating images directory..."
mkdir -p public/images

echo "📷 Copying image to public/images..."
cp ~/Downloads/denys-nevozhai-7nrsVjvALnA-unsplash.jpg public/images/

echo "✅ Image added successfully!"
echo "📍 Location: public/images/denys-nevozhai-7nrsVjvALnA-unsplash.jpg"
echo ""
echo "📝 Update your CSS with:"
echo "url('/images/denys-nevozhai-7nrsVjvALnA-unsplash.jpg')"
