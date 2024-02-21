document.addEventListener("DOMContentLoaded", function() {
    // Create a link element
    var menuLink = document.createElement("a");
    menuLink.href = "../#menu";
    menuLink.textContent = "Menu";
    menuLink.id = "menuLink";

    // Style the link
    menuLink.style.position = "fixed";
    menuLink.style.top = "10px";
    
    menuLink.style.right = "10px";
    menuLink.style.color = "#000";
    menuLink.style.textDecoration = "none";
    menuLink.style.padding = "10px";
    menuLink.style.backgroundColor = "#fff"; // Optional background color

    var brandLink = document.createElement("a");
    brandLink.href = "../#menu";
   brandLink.textContent = "Linksaw";
   brandLink.id = "brandLink";

    // Style the link
    brandLink.style.position = "fixed";
    brandLink.style.top = "10px";
    brandLink.style.left = "10px";
    brandLink.style.color = "#000";
    brandLink.style.textDecoration = "none";
    brandLink.style.padding = "10px";
    brandLink.style.backgroundColor = "#fff"; // Optional background color

    

    // Append the link to the body
    document.body.appendChild(menuLink);
    document.body.appendChild(brandLink);
   

});
