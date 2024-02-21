// header.js

// Your data
var headerData = {
    brand: 'Your Brand',
    linkText: 'Home'
};

// Get the template from the script tag
var template = document.getElementById('nav-template').innerHTML;

// Render the template with the data
var headerContent = Mustache.render(template, headerData);

// Find the header container and insert the header content
var headerContainer = document.getElementById('header');
if (headerContainer) {
    headerContainer.innerHTML = headerContent;
} else {
    console.error('Header container not found.');
}
