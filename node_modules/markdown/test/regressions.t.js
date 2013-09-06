var markdown = require("../lib/markdown"),
    tap = require("tap"),
    Markdown = markdown.Markdown,
    mk_block = Markdown.mk_block;


/*
 * This file contains tests that check various regressions on the individual
 * parsers, rather than the parser as a whole.
 */

function test(name, cb) {
  tap.test( name, function(t) {
    cb(t, new Markdown );
    t.end();
  });
};

test("split_block", function(t, md) {
  t.equivalent(
      md.split_blocks( "# h1 #\n\npara1\npara1L2\n  \n\n\n\npara2\n" ),
      [mk_block( "# h1 #", "\n\n", 1 ),
       mk_block( "para1\npara1L2", "\n  \n\n\n\n", 3 ),
       mk_block( "para2", "\n", 9 )
      ],
      "split_block should record trailing newlines");

  t.equivalent(
      md.split_blocks( "\n\n# heading #\n\npara\n" ),
      [mk_block( "# heading #", "\n\n", 3 ),
       mk_block( "para", "\n", 5 )
      ],
      "split_block should ignore leading newlines");
});

test("headers", function(t, md) {
  t.equivalent(
    md.dialect.block.setextHeader( "h1\n===\n\n", [] ),
    [ [ 'header', { level: 1 }, 'h1' ] ],
    "Atx and Setext style H1s should produce the same output" );

  t.equivalent(
    md.dialect.block.atxHeader.call( md, "# h1\n\n"),
    [ [ 'header', { level: 1 }, 'h1' ] ],
    "Closing # optional on atxHeader");

  t.equivalent(
    h2 = md.dialect.block.atxHeader.call( md, "## h2\n\n", [] ),
    [["header", {level: 2}, "h2"]],
    "Atx h2 has right level");

  t.equivalent(
    md.dialect.block.setextHeader.call( md, "h2\n---\n\n", [] ),
    [["header", {level: 2}, "h2"]],
    "Atx and Setext style H2s should produce the same output" );
});

test("code", function(t, md) {
  var code = md.dialect.block.code,
      next = [ mk_block("next") ];

  t.equivalent(
    code.call( md, mk_block("    foo\n    bar"), next ),
    [["code_block", "foo\nbar" ]],
    "Code block correct");

  t.equivalent(
    next, [mk_block("next")],
    "next untouched when its not code");

  next = [];
  t.equivalent(
    code.call( md, mk_block("    foo\n  bar"), next ),
    [["code_block", "foo" ]],
    "Code block correct for abutting para");

  t.equivalent(
    next, [mk_block("  bar")],
    "paragraph put back into next block");

  t.equivalent(
    code.call( md, mk_block("    foo"), [mk_block("    bar"), ] ),
    [["code_block", "foo\n\nbar" ]],
    "adjacent code blocks ");

  t.equivalent(
    code.call( md, mk_block("    foo","\n  \n      \n"), [mk_block("    bar"), ] ),
    [["code_block", "foo\n\n\nbar" ]],
    "adjacent code blocks preserve correct number of empty lines");

});

test( "bulletlist", function(t, md) {
  var bl = function() { return md.dialect.block.lists.apply(md, arguments) };

  t.equivalent(
    bl( mk_block("* foo\n* bar"), [] ),
    [ [ "bulletlist", [ "listitem", "foo" ], [ "listitem", "bar" ] ] ],
    "single line bullets");

  t.equivalent(
    bl( mk_block("* [text](url)" ), [] ),
    [ [ "bulletlist", [ "listitem", [ "link", { href: "url" }, "text" ] ] ] ],
    "link in bullet");

  t.equivalent(
    bl( mk_block("* foo\nbaz\n* bar\nbaz"), [] ),
    [ [ "bulletlist", [ "listitem", "foo\nbaz" ], [ "listitem", "bar\nbaz" ] ] ],
    "multiline lazy bullets");

  t.equivalent(
    bl( mk_block("* foo\n  baz\n* bar\n  baz"), [] ),
    [ [ "bulletlist", [ "listitem", "foo\nbaz" ], [ "listitem", "bar\nbaz" ] ] ],
    "multiline tidy bullets");

  t.equivalent(
    bl( mk_block("* foo\n     baz"), [] ),
    [ [ "bulletlist", [ "listitem", "foo\n baz" ] ] ],
    "only trim 4 spaces from the start of the line");

  /* Test wrong: should end up with 3 nested lists here
  t.equivalent(
    bl( mk_block(" * one\n  * two\n   * three" ), [] ),
    [ [ "bulletlist", [ "listitem", "one" ], [ "listitem", "two" ], [ "listitem", "three" ] ] ],
    "bullets can be indented up to three spaces");
  */

  t.equivalent(
    bl( mk_block("  * one"), [ mk_block("    two") ] ),
    [ [ "bulletlist", [ "listitem", [ "para", "one" ], [ "para", "two" ] ] ] ],
    "loose bullet lists can have multiple paragraphs");

  /* Case: no space after bullet - not a list
   | *↵
   |foo
   */
  t.equivalent(
    bl( mk_block(" *\nfoo") ),
    undefined,
    "Space required after bullet to trigger list");

  /* Case: note the space after the bullet
   | *␣
   |foo
   |bar
   */
  t.equivalent(
    bl( mk_block(" * \nfoo\nbar"), [ ] ),
    [ [ "bulletlist", [ "listitem", "foo\nbar" ] ] ],
    "space+continuation lines", {todo: true} );


  /* Case I:
   | * foo
   |     * bar
   |   * baz
   */
  t.equivalent(
    bl( mk_block(" * foo\n" +
                 "      * bar\n" +
                 "    * baz"),
        [] ),
    [ [ "bulletlist",
        [ "listitem",
          "foo",
          [ "bulletlist",
            [ "listitem",
              "bar",
              [ "bulletlist",
                [ "listitem", "baz" ]
              ]
            ]
          ]
        ]
    ] ],
    "Interesting indented lists I");

  /* Case II:
   | * foo
   |      * bar
   | * baz
   */
  t.equivalent(
    bl( mk_block(" * foo\n      * bar\n * baz"), [] ),
    [ [ "bulletlist",
        [ "listitem",
          "foo",
          [ "bulletlist",
            [ "listitem", "bar" ]
          ]
        ],
        [ "listitem", "baz" ]
    ] ],
    "Interesting indented lists II");

  /* Case III:
   |  * foo
   |   * bar
   |* baz
   | * fnord
   */
  t.equivalent(
    bl( mk_block("  * foo\n   * bar\n* baz\n * fnord"), [] ),
    [ [ "bulletlist",
        [ "listitem",
          "foo",
          [ "bulletlist",
            [ "listitem", "bar" ],
            [ "listitem", "baz" ],
            [ "listitem", "fnord" ]
          ]
        ]
    ] ],
    "Interesting indented lists III");

  /* Case IV:
   | * foo
   |
   | 1. bar
   */
  t.equivalent(
    bl( mk_block(" * foo"), [ mk_block(" 1. bar\n") ] ),
    [ [ "bulletlist",
        ["listitem", ["para", "foo"] ],
        ["listitem", ["para", "bar"] ]
    ] ],
    "Different lists at same indent IV");

  /* Case V:
   |   * foo
   |  * bar
   | * baz
   */
  t.equivalent(
    bl( mk_block("   * foo\n  * bar\n * baz"), [] ),
    [ [ "bulletlist",
        [ "listitem",
          "foo",
          [ "bulletlist",
            ["listitem", "bar"],
            ["listitem", "baz"],
          ]
        ]
    ] ],
    "Indenting Case V")

  /* Case VI: deep nesting
   |* one
   |    * two
   |        * three
   |            * four
   */
  t.equivalent(
    bl( mk_block("* one\n    * two\n        * three\n            * four"), [] ),
    [ [ "bulletlist",
        [ "listitem",
          "one",
          [ "bulletlist",
            [ "listitem",
              "two",
              [ "bulletlist",
                [ "listitem",
                  "three",
                  [ "bulletlist",
                    [ "listitem", "four" ]
                  ]
                ]
              ]
            ]
          ]
        ]
    ] ],
    "deep nested lists VI")

  /* Case VII: This one is just fruity!
   |   * foo
   |  * bar
   | * baz
   |* HATE
   |  * flibble
   |   * quxx
   |    * nest?
   |        * where
   |      * am
   |     * i?
   */
  t.equivalent(
    bl( mk_block("   * foo\n" +
                 "  * bar\n" +
                 " * baz\n" +
                 "* HATE\n" +
                 "  * flibble\n" +
                 "   * quxx\n" +
                 "    * nest?\n" +
                 "        * where\n" +
                 "      * am\n" +
                 "     * i?"),
      [] ),
    [ [ "bulletlist",
        [ "listitem",
          "foo",
          [ "bulletlist",
            ["listitem", "bar"],
            ["listitem", "baz"],
            ["listitem", "HATE"],
            ["listitem", "flibble"]
          ]
        ],
        [ "listitem",
          "quxx",
          [ "bulletlist",
            [ "listitem",
              "nest?",
              [ "bulletlist",
                ["listitem", "where"],
                ["listitem", "am"],
                ["listitem", "i?"]
              ]
            ]
          ]
        ]
    ] ],
    "Indenting Case VII");

  /* Case VIII: Deep nesting + code block
   |   * one
   |    * two
   |        * three
   |                * four
   |
   |                foo
   */
  t.equivalent(
    bl( mk_block("   * one\n" +
                 "    1. two\n" +
                 "        * three\n" +
                 "                * four",
                 "\n\n"),
        [ mk_block("                foo") ] ),
    [ [ "bulletlist",
        [ "listitem",
          ["para", "one"],
          [ "numberlist",
            [ "listitem",
              ["para", "two"],
              [ "bulletlist",
                [ "listitem",
                  [ "para", "three\n    * four"],
                  ["code_block", "foo"]
                ]
              ]
            ]
          ]
        ]
    ] ],
    "Case VIII: Deep nesting and code block");

});

test( "horizRule", function(t, md) {
  var hr = md.dialect.block.horizRule,
      strs = ["---", "_ __", "** ** **", "--- "];
  strs.forEach( function(s) {
    t.equivalent(
      hr.call( md, mk_block(s), [] ),
      [ [ "hr" ] ],
      "simple hr from " + require('util').inspect(s));
  });
});

test( "blockquote", function(t, md) {
  var bq = md.dialect.block.blockquote;
  t.equivalent(
    bq.call( md, mk_block("> foo\n> bar"), [] ),
    [ ["blockquote", ["para", "foo\nbar"] ] ],
    "simple blockquote");

  // Note: this tests horizRule as well through block processing.
  t.equivalent(
    bq.call( md, mk_block("> foo\n> bar\n>\n>- - - "), [] ),
    [ ["blockquote",
        ["para", "foo\nbar"],
        ["hr"]
    ] ],
    "blockquote with interesting content");

});

test( "referenceDefn", function(t, md) {
  var rd = md.dialect.block.referenceDefn;

  [ '[id]: http://example.com/  "Optional Title Here"',
    "[id]: http://example.com/  'Optional Title Here'",
    '[id]: http://example.com/  (Optional Title Here)'
  ].forEach( function(s) {
    md.tree = ["markdown"];

    t.equivalent(rd.call( md, mk_block(s) ), [], "ref processed");

    t.equivalent(md.tree[ 1 ].references,
                 { "id": { href: "http://example.com/", title: "Optional Title Here" } },
                 "reference extracted");
  });

  // Check a para abbuting a ref works right
  md.tree = ["markdown"];
  var next = [];
  t.equivalent(rd.call( md, mk_block("[id]: example.com\npara"), next ), [], "ref processed");
  t.equivalent(md.tree[ 1 ].references, { "id": { href: "example.com" } }, "reference extracted");
  t.equivalent(next, [ mk_block("para") ], "paragraph put back into blocks");

});

test( "inline_br", function(t, md) {
  t.equivalent(
    md.processInline("foo  \n\\[bar"),
    [ "foo", ["linebreak"], "[bar" ], "linebreak+escape");
});

test( "inline_escape", function(t, md) {
  t.equivalent( md.processInline("\\bar"), [ "\\bar" ], "invalid escape" );
  t.equivalent( md.processInline("\\*foo*"), [ "*foo*" ], "escaped em" );
});

test( "inline_code", function(t, md) {
  t.equivalent( md.processInline("`bar`"), [ ["inlinecode", "bar" ] ], "code I" );
  t.equivalent( md.processInline("``b`ar``"), [ ["inlinecode", "b`ar" ] ], "code II" );
  t.equivalent( md.processInline("```bar``` baz"), [ ["inlinecode", "bar" ], " baz" ], "code III" );
});

test( "inline_strong_em", function(t, md) {
  // Yay for horrible edge cases >_<
  t.equivalent( md.processInline("foo *abc* bar"), [ "foo ", ["em", "abc" ], " bar" ], "strong/em I" );
  t.equivalent( md.processInline("*abc `code`"), [ "*abc ", ["inlinecode", "code" ] ], "strong/em II" );
  t.equivalent( md.processInline("*abc**def* after"), [ ["em", "abc**def" ], " after" ], "strong/em III" );
  t.equivalent( md.processInline("*em **strong * wtf**"), [ ["em", "em **strong " ], " wtf**" ], "strong/em IV" );
  t.equivalent( md.processInline("*foo _b*a*r baz"), [ [ "em", "foo _b" ], "a*r baz" ], "strong/em V" );
});

test( "inline_img", function(t, md) {

  t.equivalent( md.processInline( "![alt] (url)" ),
                                  [ [ "img", { href: "url", alt: "alt" } ] ],
                                  "inline img I" );

  t.equivalent( md.processInline( "![alt](url 'title')" ),
                                  [ [ "img", { href: "url", alt: "alt", title: "title" } ] ],
                                  "inline img II" );

  t.equivalent( md.processInline( "![alt] (url 'tit'le') after')" ),
                                  [ [ "img", { href: "url", alt: "alt", title: "tit'le" } ], " after')" ],
                                  "inline img III" );

  t.equivalent( md.processInline( "![alt] (url \"title\")" ),
                                  [ [ "img", { href: "url", alt: "alt", title: "title" } ] ],
                                  "inline img IV" );

  t.equivalent( md.processInline( '![Alt text](/path/to/img\\\\.jpg "Optional title")' ),
                                  [ [ "img", { href: "/path/to/img\\.jpg", alt: "Alt text", title: "Optional title" } ] ],
                                  "inline img IV" );

  t.equivalent( md.processInline( "![alt][id]" ),
                                  [ [ "img_ref", { ref: "id", alt: "alt", original: "![alt][id]" } ] ],
                                  "ref img I" );

  t.equivalent( md.processInline( "![alt] [id]" ),
                                  [ [ "img_ref", { ref: "id", alt: "alt", original: "![alt] [id]" } ] ],
                                  "ref img II" );
});

test( "inline_link", function(t, md) {

  t.equivalent( md.processInline( "[text] (url)" ),
                                  [ [ "link", { href: "url" }, "text" ] ],
                                  "inline link I" );

  t.equivalent( md.processInline( "[text](url 'title')" ),
                                  [ [ "link", { href: "url", title: "title" }, "text" ] ],
                                  "inline link II" );

  t.equivalent( md.processInline( "[text](url 'tit'le') after')" ),
                                  [ [ "link", { href: "url", title: "tit'le" }, "text" ], " after')" ],
                                  "inline link III" );

  t.equivalent( md.processInline( "[text](url \"title\")" ),
                                  [ [ "link", { href: "url", title: "title" }, "text" ] ],
                                  "inline link IV" );

  t.equivalent( md.processInline( "[text][id]" ),
                                  [ [ "link_ref", { ref: "id", original: "[text][id]" }, "text" ] ],
                                  "ref link I" );

  t.equivalent( md.processInline( "[text] [id]" ),
                                  [ [ "link_ref", { ref: "id", original: "[text] [id]" }, "text" ] ],
                                  "ref link II" );

  t.equivalent( md.processInline( "[to put it another way][SECTION 1] or even [link this](#SECTION-1)" ),
                                  [
                                    [ "link_ref",
                                      { ref: "section 1", original: "[to put it another way][SECTION 1]" },
                                      "to put it another way"
                                    ],
                                    " or even ",
                                    [ "link",
                                      { href: "#SECTION-1" },
                                      "link this"
                                    ],
                                  ],
                                  "ref link II" );
});

test( "inline_autolink", function(t, md) {

  t.equivalent( md.processInline( "<http://foo.com>" ),
                                  [ [ "link", { href: "http://foo.com" }, "http://foo.com" ] ],
                                  "autolink I" );

  t.equivalent( md.processInline( "<mailto:foo@bar.com>" ),
                                  [ [ "link", { href: "mailto:foo@bar.com" }, "foo@bar.com" ] ],
                                  "autolink II" );

  t.equivalent( md.processInline( "<foo@bar.com>" ),
                                  [ [ "link", { href: "mailto:foo@bar.com" }, "foo@bar.com" ] ],
                                  "autolink III" );
});