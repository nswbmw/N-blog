var markdown = require("../lib/markdown"),
    test = require("tap").test;

// var markdown = require('Markdown');

function clone_array( input ) {
  // Helper method. Since the objects are plain round trip through JSON to get
  // a clone
  return JSON.parse( JSON.stringify( input ) );
}

test("arguments untouched", function(t) {
  var input = "A [link][id] by id.\n\n[id]: http://google.com",
      tree = markdown.parse( input ),
      clone = clone_array( tree );


  var output = markdown.toHTML( tree );

  t.equivalent( tree, clone, "tree isn't modified" );
  // We had a problem where we would accidentally remove the references
  // property from the root. We want to check the output is the same when
  // called twice.
  t.equivalent( markdown.toHTML( tree ), output, "output is consistent" );

  t.end();
});

