document.addEventListener("DOMContentLoaded", function () {
    // Create header element
    var header = document.createElement("header");
    header.classList.add("sticky-header");
  
    // Create brand element
    var brand = document.createElement("a");  // Change from 'div' to 'a'
brand.classList.add("brand");
brand.style.fontWeight = "400";
brand.textContent = "Linksaw";
brand.href = "/";  
  
    // Create Profile button element
    var profileButton = document.createElement("button");
    profileButton.classList.add("header-button");
  
    // Check if the current page is "profile"
    var isProfilePage = window.location.pathname.includes("/profile");
  
    // Create Font Awesome icon based on the current page
    var menuIcon = document.createElement("i");
    menuIcon.classList.add("fas");
    if (isProfilePage) {
      menuIcon.classList.add("fa-times"); // Font Awesome "x" icon
      profileButton.addEventListener("click", function () {
        window.location.href = "/links"; // Redirect to "/links" on profile page
      });
    } else {
      menuIcon.classList.add("fa-bars"); // Font Awesome "bars" icon
      profileButton.addEventListener("click", function () {
        window.location.href = "/profile"; // Redirect to "/profile" on other pages
      });
    }
  
    // Append the icon to the profile button
    profileButton.appendChild(menuIcon);
  
    // Append brand and profileButton to header
    header.appendChild(brand);
    header.appendChild(profileButton);
  
    // Append header to the body
    document.body.appendChild(header);
  });
  