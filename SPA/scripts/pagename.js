function updateHashDisplay() {
    // Get the current hash from the URL
    var currentHash = window.location.hash;
    currentHash = currentHash.slice(1);
    currentHash = currentHash.charAt(0).toUpperCase() + currentHash.slice(1);

    // Assuming currentHash is a string
    if (currentHash.includes('-')) {
        currentHash = currentHash.replace(/-/g, " ");
    }

    // // Create a span element
    // var backToMenuSpan = document.createElement('span');
    // backToMenuSpan.textContent = '<';
    // backToMenuSpan.style.cursor = 'pointer'; // Add pointer cursor for indicating it's clickable

    // // Add click functionality to navigate to #menu
    // backToMenuSpan.addEventListener('click', function() {
    //     window.location.hash = 'menu'; // Navigate to the #menu section
    // });

    // Update the content of the h4 element with the current hash
    var pagenameElement = document.getElementById('pagename');
    pagenameElement.innerHTML = ''; // Clear existing content

    // Conditionally append the span only if the current hash is not #menu
    if (currentHash !== 'Menu') {
        // pagenameElement.appendChild(backToMenuSpan);
        pagenameElement.appendChild(document.createTextNode(' ' + currentHash));
    } else {
        pagenameElement.textContent = currentHash; // Show only the current hash without the span
    }

    // Add click functionality to navigate to #menu for the entire content
    pagenameElement.addEventListener('click', function() {
        window.location.hash = 'menu'; // Navigate to the #menu section
    });
}

// Attach the function to the hashchange event
window.addEventListener('hashchange', updateHashDisplay);

// Call the function on page load
window.addEventListener('load', updateHashDisplay);
