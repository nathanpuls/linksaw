  // Retrieve template content
  var template = document.getElementById('template').innerHTML;

  // Sample data
  var data = {
      title: 'Website',
      adjective: 'simple'
  };

  // Replace placeholders with data
  var postTemp = template.replace(/{\s*([\w.]+)\s*}/g, function(match, p1) {
      return data[p1];
  });

  // Insert rendered template into the specific container (e.g., "app")
  var appContainer = document.getElementById('app');
  appContainer.innerHTML = postTemp;