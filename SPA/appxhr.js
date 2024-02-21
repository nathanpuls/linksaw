// document.addEventListener('DOMContentLoaded', function () {
//     const appElement = document.getElementById('app');

//     function loadContent(route) {
//         const xhr = new XMLHttpRequest();
//         xhr.onreadystatechange = function () {
//             if (xhr.readyState === XMLHttpRequest.DONE) {
//                 if (xhr.status === 200) {
//                     appElement.innerHTML = xhr.responseText;
//                 } else {
//                     console.error('Error fetching content:', xhr.status, xhr.statusText);
//                     appElement.innerHTML = '<p>Error loading page</p>';
//                 }
//             }
//         };

//         xhr.open('GET', `views/${route}.html`, true);
//         xhr.send();
//     }

//     function handleNavigation() {
//         const hash = window.location.hash.substring(1);
//         loadContent(hash);
//     }

//     window.addEventListener('hashchange', handleNavigation);
//     window.addEventListener('load', handleNavigation);
// });
