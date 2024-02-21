// navbar.js
document.addEventListener("DOMContentLoaded", function () {
    // Fetch and compile the navbar template
    var navbarTemplateSource = document.getElementById("navbar-template").innerHTML;
    var navbarTemplate = Handlebars.compile(navbarTemplateSource);
  
    // Data for the navigation bar
    var navbarData = {
      brand: { href: "/", text: "Your Brand" },
      navLinks: [
        { href: "/about", label: "About" },
        // Add more navigation items as needed
      ],
    };
  
    // Render the navigation bar using Handlebars
    var navbarContainer = document.getElementById("nav");
    navbarContainer.innerHTML = navbarTemplate(navbarData);
  });
  