 // JavaScript code to dynamically create the header
 document.addEventListener('DOMContentLoaded', function () {
    // Create header element
    var header = document.createElement('header');
    header.classList.add('sticky-header');

    // Create brand element
    var brand = document.createElement('div');
    brand.classList.add('brand');
    brand.textContent = 'Linksaw';

    // Create Dash button element
    var dashButton = document.createElement('button');
    dashButton.classList.add('header-button');
    dashButton.textContent = 'Dash';
    dashButton.addEventListener('click', function () {
        window.location.href = '/dashboard.html';
    });

    // Append brand and dashButton to header
    header.appendChild(brand);
    //header.appendChild(dashButton);

    // Append header to the body
    document.body.appendChild(header);
});