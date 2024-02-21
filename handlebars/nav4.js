// navbar.js
document.addEventListener('DOMContentLoaded', function () {
    // Load the navigation bar into the specified container
    var navbarContainer = document.getElementById('navbarContainer');
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'nav4.html', true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4 && xhr.status == 200) {
            navbarContainer.innerHTML = xhr.responseText;
        }
    };
    xhr.send();
});
