
0.6.0 / 2013-04-15 
==================

  * add exposing of `Test` to enable extensibility
  * add request.agent(app) support
  * add request(url) test. Closes #33

0.5.1 2012-12-07 
==================

  * fix .expect(status) should assert only status

0.5.0/ 2012-11-28 
==================

  * add support for multiple body assertions

0.4.2 / 2012-11-17 
==================

  * add .buffer() so that responses with no content-length are testable. closes #36
  * add failing test for #36
  * update superagent

0.4.1 / 2012-11-14 
==================

  * update superagent

0.4.0 / 2012-10-18 
==================

  * add url support [vesln]

0.3.1 / 2012-10-01 
==================

  * update superagent

0.3.0 / 2012-09-24 
==================

  * add `https.Server` support [fengmk2]

0.2.0 / 2012-08-29 
==================

  * update superagent. Closes #18

0.1.2 / 2012-07-15 
==================

  * change bind address from 0.0.0.0 to 127.0.0.1 to prevent EADDRNOTAVAIL on windows

0.1.1 / 2012-07-03 
==================

  * add `.expect(status, body, fn)` support
  * add `.expect(status, body)` support

0.1.0 / 2012-07-02 
==================

  * add parsed body assertion support. Closes #1
