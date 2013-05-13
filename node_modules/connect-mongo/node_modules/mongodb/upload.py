#!/usr/bin/env python
# coding: utf-8
#
# Copyright 2007 Google Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Tool for uploading diffs from a version control system to the codereview app.

Usage summary: upload.py [options] [-- diff_options] [path...]

Diff options are passed to the diff command of the underlying system.

Supported version control systems:
  Git
  Mercurial
  Subversion
  Perforce
  CVS

It is important for Git/Mercurial users to specify a tree/node/branch to diff
against by using the '--rev' option.
"""
# This code is derived from appcfg.py in the App Engine SDK (open source),
# and from ASPN recipe #146306.

import ConfigParser
import cookielib
import errno
import fnmatch
import getpass
import logging
import marshal
import mimetypes
import optparse
import os
import re
import socket
import subprocess
import sys
import urllib
import urllib2
import urlparse

# The md5 module was deprecated in Python 2.5.
try:
  from hashlib import md5
except ImportError:
  from md5 import md5

try:
  import readline
except ImportError:
  pass

try:
  import keyring
except ImportError:
  keyring = None

# The logging verbosity:
#  0: Errors only.
#  1: Status messages.
#  2: Info logs.
#  3: Debug logs.
verbosity = 1

# The account type used for authentication.
# This line could be changed by the review server (see handler for
# upload.py).
AUTH_ACCOUNT_TYPE = "HOSTED"

# URL of the default review server. As for AUTH_ACCOUNT_TYPE, this line could be
# changed by the review server (see handler for upload.py).
DEFAULT_REVIEW_SERVER = "codereview.10gen.com"

# Max size of patch or base file.
MAX_UPLOAD_SIZE = 900 * 1024

# Constants for version control names.  Used by GuessVCSName.
VCS_GIT = "Git"
VCS_MERCURIAL = "Mercurial"
VCS_SUBVERSION = "Subversion"
VCS_PERFORCE = "Perforce"
VCS_CVS = "CVS"
VCS_UNKNOWN = "Unknown"

VCS_ABBREVIATIONS = {
  VCS_MERCURIAL.lower(): VCS_MERCURIAL,
  "hg": VCS_MERCURIAL,
  VCS_SUBVERSION.lower(): VCS_SUBVERSION,
  "svn": VCS_SUBVERSION,
  VCS_PERFORCE.lower(): VCS_PERFORCE,
  "p4": VCS_PERFORCE,
  VCS_GIT.lower(): VCS_GIT,
  VCS_CVS.lower(): VCS_CVS,
}

# The result of parsing Subversion's [auto-props] setting.
svn_auto_props_map = None

def GetEmail(prompt):
  """Prompts the user for their email address and returns it.

  The last used email address is saved to a file and offered up as a suggestion
  to the user. If the user presses enter without typing in anything the last
  used email address is used. If the user enters a new address, it is saved
  for next time we prompt.

  """
  last_email_file_name = os.path.expanduser("~/.last_codereview_email_address")
  last_email = ""
  if os.path.exists(last_email_file_name):
    try:
      last_email_file = open(last_email_file_name, "r")
      last_email = last_email_file.readline().strip("\n")
      last_email_file.close()
      prompt += " [%s]" % last_email
    except IOError, e:
      pass
  email = raw_input(prompt + ": ").strip()
  if email:
    try:
      last_email_file = open(last_email_file_name, "w")
      last_email_file.write(email)
      last_email_file.close()
    except IOError, e:
      pass
  else:
    email = last_email
  return email


def StatusUpdate(msg):
  """Print a status message to stdout.

  If 'verbosity' is greater than 0, print the message.

  Args:
    msg: The string to print.
  """
  if verbosity > 0:
    print msg


def ErrorExit(msg):
  """Print an error message to stderr and exit."""
  print >>sys.stderr, msg
  sys.exit(1)


class ClientLoginError(urllib2.HTTPError):
  """Raised to indicate there was an error authenticating with ClientLogin."""

  def __init__(self, url, code, msg, headers, args):
    urllib2.HTTPError.__init__(self, url, code, msg, headers, None)
    self.args = args
    self.reason = args["Error"]
    self.info = args.get("Info", None)


class AbstractRpcServer(object):
  """Provides a common interface for a simple RPC server."""

  def __init__(self, host, auth_function, host_override=None, extra_headers={},
               save_cookies=False, account_type=AUTH_ACCOUNT_TYPE):
    """Creates a new HttpRpcServer.

    Args:
      host: The host to send requests to.
      auth_function: A function that takes no arguments and returns an
        (email, password) tuple when called. Will be called if authentication
        is required.
      host_override: The host header to send to the server (defaults to host).
      extra_headers: A dict of extra headers to append to every request.
      save_cookies: If True, save the authentication cookies to local disk.
        If False, use an in-memory cookiejar instead.  Subclasses must
        implement this functionality.  Defaults to False.
      account_type: Account type used for authentication. Defaults to
        AUTH_ACCOUNT_TYPE.
    """
    self.host = host
    if (not self.host.startswith("http://") and
        not self.host.startswith("https://")):
      self.host = "http://" + self.host
    self.host_override = host_override
    self.auth_function = auth_function
    self.authenticated = False
    self.extra_headers = extra_headers
    self.save_cookies = save_cookies
    self.account_type = account_type
    self.opener = self._GetOpener()
    if self.host_override:
      logging.info("Server: %s; Host: %s", self.host, self.host_override)
    else:
      logging.info("Server: %s", self.host)

  def _GetOpener(self):
    """Returns an OpenerDirector for making HTTP requests.

    Returns:
      A urllib2.OpenerDirector object.
    """
    raise NotImplementedError()

  def _CreateRequest(self, url, data=None):
    """Creates a new urllib request."""
    logging.debug("Creating request for: '%s' with payload:\n%s", url, data)
    req = urllib2.Request(url, data=data, headers={"Accept": "text/plain"})
    if self.host_override:
      req.add_header("Host", self.host_override)
    for key, value in self.extra_headers.iteritems():
      req.add_header(key, value)
    return req

  def _GetAuthToken(self, email, password):
    """Uses ClientLogin to authenticate the user, returning an auth token.

    Args:
      email:    The user's email address
      password: The user's password

    Raises:
      ClientLoginError: If there was an error authenticating with ClientLogin.
      HTTPError: If there was some other form of HTTP error.

    Returns:
      The authentication token returned by ClientLogin.
    """
    account_type = self.account_type
    if self.host.endswith(".google.com"):
      # Needed for use inside Google.
      account_type = "HOSTED"
    req = self._CreateRequest(
        url="https://www.google.com/accounts/ClientLogin",
        data=urllib.urlencode({
            "Email": email,
            "Passwd": password,
            "service": "ah",
            "source": "rietveld-codereview-upload",
            "accountType": account_type,
        }),
    )
    try:
      response = self.opener.open(req)
      response_body = response.read()
      response_dict = dict(x.split("=")
                           for x in response_body.split("\n") if x)
      return response_dict["Auth"]
    except urllib2.HTTPError, e:
      if e.code == 403:
        body = e.read()
        response_dict = dict(x.split("=", 1) for x in body.split("\n") if x)
        raise ClientLoginError(req.get_full_url(), e.code, e.msg,
                               e.headers, response_dict)
      else:
        raise

  def _GetAuthCookie(self, auth_token):
    """Fetches authentication cookies for an authentication token.

    Args:
      auth_token: The authentication token returned by ClientLogin.

    Raises:
      HTTPError: If there was an error fetching the authentication cookies.
    """
    # This is a dummy value to allow us to identify when we're successful.
    continue_location = "http://localhost/"
    args = {"continue": continue_location, "auth": auth_token}
    req = self._CreateRequest("%s/_ah/login?%s" %
                              (self.host, urllib.urlencode(args)))
    try:
      response = self.opener.open(req)
    except urllib2.HTTPError, e:
      response = e
    if (response.code != 302 or
        response.info()["location"] != continue_location):
      raise urllib2.HTTPError(req.get_full_url(), response.code, response.msg,
                              response.headers, response.fp)
    self.authenticated = True

  def _Authenticate(self):
    """Authenticates the user.

    The authentication process works as follows:
     1) We get a username and password from the user
     2) We use ClientLogin to obtain an AUTH token for the user
        (see http://code.google.com/apis/accounts/AuthForInstalledApps.html).
     3) We pass the auth token to /_ah/login on the server to obtain an
        authentication cookie. If login was successful, it tries to redirect
        us to the URL we provided.

    If we attempt to access the upload API without first obtaining an
    authentication cookie, it returns a 401 response (or a 302) and
    directs us to authenticate ourselves with ClientLogin.
    """
    for i in range(3):
      credentials = self.auth_function()
      try:
        auth_token = self._GetAuthToken(credentials[0], credentials[1])
      except ClientLoginError, e:
        print >>sys.stderr, ''
        if e.reason == "BadAuthentication":
          if e.info == "InvalidSecondFactor":
            print >>sys.stderr, (
                "Use an application-specific password instead "
                "of your regular account password.\n"
                "See http://www.google.com/"
                "support/accounts/bin/answer.py?answer=185833")
          else:
            print >>sys.stderr, "Invalid username or password."
        elif e.reason == "CaptchaRequired":
          print >>sys.stderr, (
              "Please go to\n"
              "https://www.google.com/accounts/DisplayUnlockCaptcha\n"
              "and verify you are a human.  Then try again.\n"
              "If you are using a Google Apps account the URL is:\n"
              "https://www.google.com/a/yourdomain.com/UnlockCaptcha")
        elif e.reason == "NotVerified":
          print >>sys.stderr, "Account not verified."
        elif e.reason == "TermsNotAgreed":
          print >>sys.stderr, "User has not agreed to TOS."
        elif e.reason == "AccountDeleted":
          print >>sys.stderr, "The user account has been deleted."
        elif e.reason == "AccountDisabled":
          print >>sys.stderr, "The user account has been disabled."
          break
        elif e.reason == "ServiceDisabled":
          print >>sys.stderr, ("The user's access to the service has been "
                               "disabled.")
        elif e.reason == "ServiceUnavailable":
          print >>sys.stderr, "The service is not available; try again later."
        else:
          # Unknown error.
          raise
        print >>sys.stderr, ''
        continue
      self._GetAuthCookie(auth_token)
      return

  def Send(self, request_path, payload=None,
           content_type="application/octet-stream",
           timeout=None,
           extra_headers=None,
           **kwargs):
    """Sends an RPC and returns the response.

    Args:
      request_path: The path to send the request to, eg /api/appversion/create.
      payload: The body of the request, or None to send an empty request.
      content_type: The Content-Type header to use.
      timeout: timeout in seconds; default None i.e. no timeout.
        (Note: for large requests on OS X, the timeout doesn't work right.)
      extra_headers: Dict containing additional HTTP headers that should be
        included in the request (string header names mapped to their values),
        or None to not include any additional headers.
      kwargs: Any keyword arguments are converted into query string parameters.

    Returns:
      The response body, as a string.
    """
    # TODO: Don't require authentication.  Let the server say
    # whether it is necessary.
    if not self.authenticated:
      self._Authenticate()

    old_timeout = socket.getdefaulttimeout()
    socket.setdefaulttimeout(timeout)
    try:
      tries = 0
      while True:
        tries += 1
        args = dict(kwargs)
        url = "%s%s" % (self.host, request_path)
        if args:
          url += "?" + urllib.urlencode(args)
        req = self._CreateRequest(url=url, data=payload)
        req.add_header("Content-Type", content_type)
        if extra_headers:
          for header, value in extra_headers.items():
            req.add_header(header, value)
        try:
          f = self.opener.open(req)
          response = f.read()
          f.close()
          return response
        except urllib2.HTTPError, e:
          if tries > 3:
            raise
          elif e.code == 401 or e.code == 302:
            self._Authenticate()
          elif e.code == 301:
            # Handle permanent redirect manually.
            url = e.info()["location"]
            url_loc = urlparse.urlparse(url)
            self.host = '%s://%s' % (url_loc[0], url_loc[1])
          elif e.code >= 500:
            ErrorExit(e.read())
          else:
            raise
    finally:
      socket.setdefaulttimeout(old_timeout)


class HttpRpcServer(AbstractRpcServer):
  """Provides a simplified RPC-style interface for HTTP requests."""

  def _Authenticate(self):
    """Save the cookie jar after authentication."""
    super(HttpRpcServer, self)._Authenticate()
    if self.save_cookies:
      StatusUpdate("Saving authentication cookies to %s" % self.cookie_file)
      self.cookie_jar.save()

  def _GetOpener(self):
    """Returns an OpenerDirector that supports cookies and ignores redirects.

    Returns:
      A urllib2.OpenerDirector object.
    """
    opener = urllib2.OpenerDirector()
    opener.add_handler(urllib2.ProxyHandler())
    opener.add_handler(urllib2.UnknownHandler())
    opener.add_handler(urllib2.HTTPHandler())
    opener.add_handler(urllib2.HTTPDefaultErrorHandler())
    opener.add_handler(urllib2.HTTPSHandler())
    opener.add_handler(urllib2.HTTPErrorProcessor())
    if self.save_cookies:
      self.cookie_file = os.path.expanduser("~/.codereview_upload_cookies")
      self.cookie_jar = cookielib.MozillaCookieJar(self.cookie_file)
      if os.path.exists(self.cookie_file):
        try:
          self.cookie_jar.load()
          self.authenticated = True
          StatusUpdate("Loaded authentication cookies from %s" %
                       self.cookie_file)
        except (cookielib.LoadError, IOError):
          # Failed to load cookies - just ignore them.
          pass
      else:
        # Create an empty cookie file with mode 600
        fd = os.open(self.cookie_file, os.O_CREAT, 0600)
        os.close(fd)
      # Always chmod the cookie file
      os.chmod(self.cookie_file, 0600)
    else:
      # Don't save cookies across runs of update.py.
      self.cookie_jar = cookielib.CookieJar()
    opener.add_handler(urllib2.HTTPCookieProcessor(self.cookie_jar))
    return opener


class CondensedHelpFormatter(optparse.IndentedHelpFormatter):
   """Frees more horizontal space by removing indentation from group
      options and collapsing arguments between short and long, e.g.
      '-o ARG, --opt=ARG' to -o --opt ARG"""

   def format_heading(self, heading):
     return "%s:\n" % heading

   def format_option(self, option):
     self.dedent()
     res = optparse.HelpFormatter.format_option(self, option)
     self.indent()
     return res

   def format_option_strings(self, option):
     self.set_long_opt_delimiter(" ")
     optstr = optparse.HelpFormatter.format_option_strings(self, option)
     optlist = optstr.split(", ")
     if len(optlist) > 1:
       if option.takes_value():
         # strip METAVAR from all but the last option
         optlist = [x.split()[0] for x in optlist[:-1]] + optlist[-1:]
       optstr = " ".join(optlist)
     return optstr


parser = optparse.OptionParser(
    usage="%prog [options] [-- diff_options] [path...]",
    add_help_option=False,
    formatter=CondensedHelpFormatter()
)
parser.add_option("-h", "--help", action="store_true",
                  help="Show this help message and exit.")
parser.add_option("-y", "--assume_yes", action="store_true",
                  dest="assume_yes", default=False,
                  help="Assume that the answer to yes/no questions is 'yes'.")
# Logging
group = parser.add_option_group("Logging options")
group.add_option("-q", "--quiet", action="store_const", const=0,
                 dest="verbose", help="Print errors only.")
group.add_option("-v", "--verbose", action="store_const", const=2,
                 dest="verbose", default=1,
                 help="Print info level logs.")
group.add_option("--noisy", action="store_const", const=3,
                 dest="verbose", help="Print all logs.")
group.add_option("--print_diffs", dest="print_diffs", action="store_true",
                 help="Print full diffs.")
# Review server
group = parser.add_option_group("Review server options")
group.add_option("-s", "--server", action="store", dest="server",
                 default=DEFAULT_REVIEW_SERVER,
                 metavar="SERVER",
                 help=("The server to upload to. The format is host[:port]. "
                       "Defaults to '%default'."))
group.add_option("-e", "--email", action="store", dest="email",
                 metavar="EMAIL", default=None,
                 help="The username to use. Will prompt if omitted.")
group.add_option("-H", "--host", action="store", dest="host",
                 metavar="HOST", default=None,
                 help="Overrides the Host header sent with all RPCs.")
group.add_option("--no_cookies", action="store_false",
                 dest="save_cookies", default=True,
                 help="Do not save authentication cookies to local disk.")
group.add_option("--account_type", action="store", dest="account_type",
                 metavar="TYPE", default=AUTH_ACCOUNT_TYPE,
                 choices=["GOOGLE", "HOSTED"],
                 help=("Override the default account type "
                       "(defaults to '%default', "
                       "valid choices are 'GOOGLE' and 'HOSTED')."))
# Issue
group = parser.add_option_group("Issue options")
group.add_option("-t", "--title", action="store", dest="title",
                 help="New issue subject or new patch set title")
group.add_option("-m", "--message", action="store", dest="message",
                 default=None,
                 help="New issue description or new patch set message")
group.add_option("-F", "--file", action="store", dest="file",
                 default=None, help="Read the message above from file.")
group.add_option("-r", "--reviewers", action="store", dest="reviewers",
                 metavar="REVIEWERS", default=None,
                 help="Add reviewers (comma separated email addresses).")
group.add_option("--cc", action="store", dest="cc",
                 metavar="CC", default=None,
                 help="Add CC (comma separated email addresses).")
group.add_option("--private", action="store_true", dest="private",
                 default=False,
                 help="Make the issue restricted to reviewers and those CCed")
# Upload options
group = parser.add_option_group("Patch options")
group.add_option("-i", "--issue", type="int", action="store",
                 metavar="ISSUE", default=None,
                 help="Issue number to which to add. Defaults to new issue.")
group.add_option("--base_url", action="store", dest="base_url", default=None,
                 help="Base URL path for files (listed as \"Base URL\" when "
                 "viewing issue).  If omitted, will be guessed automatically "
                 "for SVN repos and left blank for others.")
group.add_option("--download_base", action="store_true",
                 dest="download_base", default=False,
                 help="Base files will be downloaded by the server "
                 "(side-by-side diffs may not work on files with CRs).")
group.add_option("--rev", action="store", dest="revision",
                 metavar="REV", default=None,
                 help="Base revision/branch/tree to diff against. Use "
                      "rev1:rev2 range to review already committed changeset.")
group.add_option("--send_mail", action="store_true",
                 dest="send_mail", default=False,
                 help="Send notification email to reviewers.")
group.add_option("-p", "--send_patch", action="store_true",
                 dest="send_patch", default=False,
                 help="Same as --send_mail, but include diff as an "
                      "attachment, and prepend email subject with 'PATCH:'.")
group.add_option("--vcs", action="store", dest="vcs",
                 metavar="VCS", default=None,
                 help=("Version control system (optional, usually upload.py "
                       "already guesses the right VCS)."))
group.add_option("--emulate_svn_auto_props", action="store_true",
                 dest="emulate_svn_auto_props", default=False,
                 help=("Emulate Subversion's auto properties feature."))
# Perforce-specific
group = parser.add_option_group("Perforce-specific options "
                                "(overrides P4 environment variables)")
group.add_option("--p4_port", action="store", dest="p4_port",
                 metavar="P4_PORT", default=None,
                 help=("Perforce server and port (optional)"))
group.add_option("--p4_changelist", action="store", dest="p4_changelist",
                 metavar="P4_CHANGELIST", default=None,
                 help=("Perforce changelist id"))
group.add_option("--p4_client", action="store", dest="p4_client",
                 metavar="P4_CLIENT", default=None,
                 help=("Perforce client/workspace"))
group.add_option("--p4_user", action="store", dest="p4_user",
                 metavar="P4_USER", default=None,
                 help=("Perforce user"))

def GetRpcServer(server, email=None, host_override=None, save_cookies=True,
                 account_type=AUTH_ACCOUNT_TYPE):
  """Returns an instance of an AbstractRpcServer.

  Args:
    server: String containing the review server URL.
    email: String containing user's email address.
    host_override: If not None, string containing an alternate hostname to use
      in the host header.
    save_cookies: Whether authentication cookies should be saved to disk.
    account_type: Account type for authentication, either 'GOOGLE'
      or 'HOSTED'. Defaults to AUTH_ACCOUNT_TYPE.

  Returns:
    A new AbstractRpcServer, on which RPC calls can be made.
  """

  rpc_server_class = HttpRpcServer

  # If this is the dev_appserver, use fake authentication.
  host = (host_override or server).lower()
  if re.match(r'(http://)?localhost([:/]|$)', host):
    if email is None:
      email = "test@example.com"
      logging.info("Using debug user %s.  Override with --email" % email)
    server = rpc_server_class(
        server,
        lambda: (email, "password"),
        host_override=host_override,
        extra_headers={"Cookie":
                       'dev_appserver_login="%s:False"' % email},
        save_cookies=save_cookies,
        account_type=account_type)
    # Don't try to talk to ClientLogin.
    server.authenticated = True
    return server

  def GetUserCredentials():
    """Prompts the user for a username and password."""
    # Create a local alias to the email variable to avoid Python's crazy
    # scoping rules.
    global keyring
    local_email = email
    if local_email is None:
      local_email = GetEmail("Email (login for uploading to %s)" % server)
    password = None
    if keyring:
      try:
        password = keyring.get_password(host, local_email)
      except:
        # Sadly, we have to trap all errors here as
        # gnomekeyring.IOError inherits from object. :/
        print "Failed to get password from keyring"
        keyring = None
    if password is not None:
      print "Using password from system keyring."
    else:
      password = getpass.getpass("Password for %s: " % local_email)
      if keyring:
        answer = raw_input("Store password in system keyring?(y/N) ").strip()
        if answer == "y":
          keyring.set_password(host, local_email, password)
    return (local_email, password)

  return rpc_server_class(server,
                          GetUserCredentials,
                          host_override=host_override,
                          save_cookies=save_cookies)


def EncodeMultipartFormData(fields, files):
  """Encode form fields for multipart/form-data.

  Args:
    fields: A sequence of (name, value) elements for regular form fields.
    files: A sequence of (name, filename, value) elements for data to be
           uploaded as files.
  Returns:
    (content_type, body) ready for httplib.HTTP instance.

  Source:
    http://aspn.activestate.com/ASPN/Cookbook/Python/Recipe/146306
  """
  BOUNDARY = '-M-A-G-I-C---B-O-U-N-D-A-R-Y-'
  CRLF = '\r\n'
  lines = []
  for (key, value) in fields:
    lines.append('--' + BOUNDARY)
    lines.append('Content-Disposition: form-data; name="%s"' % key)
    lines.append('')
    if isinstance(value, unicode):
      value = value.encode('utf-8')
    lines.append(value)
  for (key, filename, value) in files:
    lines.append('--' + BOUNDARY)
    lines.append('Content-Disposition: form-data; name="%s"; filename="%s"' %
             (key, filename))
    lines.append('Content-Type: %s' % GetContentType(filename))
    lines.append('')
    if isinstance(value, unicode):
      value = value.encode('utf-8')
    lines.append(value)
  lines.append('--' + BOUNDARY + '--')
  lines.append('')
  body = CRLF.join(lines)
  content_type = 'multipart/form-data; boundary=%s' % BOUNDARY
  return content_type, body


def GetContentType(filename):
  """Helper to guess the content-type from the filename."""
  return mimetypes.guess_type(filename)[0] or 'application/octet-stream'


# Use a shell for subcommands on Windows to get a PATH search.
use_shell = sys.platform.startswith("win")

def RunShellWithReturnCodeAndStderr(command, print_output=False,
                           universal_newlines=True,
                           env=os.environ):
  """Executes a command and returns the output from stdout, stderr and the return code.

  Args:
    command: Command to execute.
    print_output: If True, the output is printed to stdout.
                  If False, both stdout and stderr are ignored.
    universal_newlines: Use universal_newlines flag (default: True).

  Returns:
    Tuple (stdout, stderr, return code)
  """
  logging.info("Running %s", command)
  env = env.copy()
  env['LC_MESSAGES'] = 'C'
  p = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                       shell=use_shell, universal_newlines=universal_newlines,
                       env=env)
  if print_output:
    output_array = []
    while True:
      line = p.stdout.readline()
      if not line:
        break
      print line.strip("\n")
      output_array.append(line)
    output = "".join(output_array)
  else:
    output = p.stdout.read()
  p.wait()
  errout = p.stderr.read()
  if print_output and errout:
    print >>sys.stderr, errout
  p.stdout.close()
  p.stderr.close()
  return output, errout, p.returncode

def RunShellWithReturnCode(command, print_output=False,
                           universal_newlines=True,
                           env=os.environ):
  """Executes a command and returns the output from stdout and the return code."""
  out, err, retcode = RunShellWithReturnCodeAndStderr(command, print_output,
                           universal_newlines, env)
  return out, retcode

def RunShell(command, silent_ok=False, universal_newlines=True,
             print_output=False, env=os.environ):
  data, retcode = RunShellWithReturnCode(command, print_output,
                                         universal_newlines, env)
  if retcode:
    ErrorExit("Got error status from %s:\n%s" % (command, data))
  if not silent_ok and not data:
    ErrorExit("No output from %s" % command)
  return data


class VersionControlSystem(object):
  """Abstract base class providing an interface to the VCS."""

  def __init__(self, options):
    """Constructor.

    Args:
      options: Command line options.
    """
    self.options = options

  def GetGUID(self):
    """Return string to distinguish the repository from others, for example to
    query all opened review issues for it"""
    raise NotImplementedError(
        "abstract method -- subclass %s must override" % self.__class__)

  def PostProcessDiff(self, diff):
    """Return the diff with any special post processing this VCS needs, e.g.
    to include an svn-style "Index:"."""
    return diff

  def GenerateDiff(self, args):
    """Return the current diff as a string.

    Args:
      args: Extra arguments to pass to the diff command.
    """
    raise NotImplementedError(
        "abstract method -- subclass %s must override" % self.__class__)

  def GetUnknownFiles(self):
    """Return a list of files unknown to the VCS."""
    raise NotImplementedError(
        "abstract method -- subclass %s must override" % self.__class__)

  def CheckForUnknownFiles(self):
    """Show an "are you sure?" prompt if there are unknown files."""
    unknown_files = self.GetUnknownFiles()
    if unknown_files:
      print "The following files are not added to version control:"
      for line in unknown_files:
        print line
      prompt = "Are you sure to continue?(y/N) "
      answer = raw_input(prompt).strip()
      if answer != "y":
        ErrorExit("User aborted")

  def GetBaseFile(self, filename):
    """Get the content of the upstream version of a file.

    Returns:
      A tuple (base_content, new_content, is_binary, status)
        base_content: The contents of the base file.
        new_content: For text files, this is empty.  For binary files, this is
          the contents of the new file, since the diff output won't contain
          information to reconstruct the current file.
        is_binary: True iff the file is binary.
        status: The status of the file.
    """

    raise NotImplementedError(
        "abstract method -- subclass %s must override" % self.__class__)


  def GetBaseFiles(self, diff):
    """Helper that calls GetBase file for each file in the patch.

    Returns:
      A dictionary that maps from filename to GetBaseFile's tuple.  Filenames
      are retrieved based on lines that start with "Index:" or
      "Property changes on:".
    """
    files = {}
    for line in diff.splitlines(True):
      if line.startswith('Index:') or line.startswith('Property changes on:'):
        unused, filename = line.split(':', 1)
        # On Windows if a file has property changes its filename uses '\'
        # instead of '/'.
        filename = filename.strip().replace('\\', '/')
        files[filename] = self.GetBaseFile(filename)
    return files


  def UploadBaseFiles(self, issue, rpc_server, patch_list, patchset, options,
                      files):
    """Uploads the base files (and if necessary, the current ones as well)."""

    def UploadFile(filename, file_id, content, is_binary, status, is_base):
      """Uploads a file to the server."""
      file_too_large = False
      if is_base:
        type = "base"
      else:
        type = "current"
      if len(content) > MAX_UPLOAD_SIZE:
        print ("Not uploading the %s file for %s because it's too large." %
               (type, filename))
        file_too_large = True
        content = ""
      checksum = md5(content).hexdigest()
      if options.verbose > 0 and not file_too_large:
        print "Uploading %s file for %s" % (type, filename)
      url = "/%d/upload_content/%d/%d" % (int(issue), int(patchset), file_id)
      form_fields = [("filename", filename),
                     ("status", status),
                     ("checksum", checksum),
                     ("is_binary", str(is_binary)),
                     ("is_current", str(not is_base)),
                    ]
      if file_too_large:
        form_fields.append(("file_too_large", "1"))
      if options.email:
        form_fields.append(("user", options.email))
      ctype, body = EncodeMultipartFormData(form_fields,
                                            [("data", filename, content)])
      response_body = rpc_server.Send(url, body,
                                      content_type=ctype)
      if not response_body.startswith("OK"):
        StatusUpdate("  --> %s" % response_body)
        sys.exit(1)

    patches = dict()
    [patches.setdefault(v, k) for k, v in patch_list]
    for filename in patches.keys():
      base_content, new_content, is_binary, status = files[filename]
      file_id_str = patches.get(filename)
      if file_id_str.find("nobase") != -1:
        base_content = None
        file_id_str = file_id_str[file_id_str.rfind("_") + 1:]
      file_id = int(file_id_str)
      if base_content != None:
        UploadFile(filename, file_id, base_content, is_binary, status, True)
      if new_content != None:
        UploadFile(filename, file_id, new_content, is_binary, status, False)

  def IsImage(self, filename):
    """Returns true if the filename has an image extension."""
    mimetype =  mimetypes.guess_type(filename)[0]
    if not mimetype:
      return False
    return mimetype.startswith("image/")

  def IsBinaryData(self, data):
    """Returns true if data contains a null byte."""
    # Derived from how Mercurial's heuristic, see
    # http://selenic.com/hg/file/848a6658069e/mercurial/util.py#l229
    return bool(data and "\0" in data)


class SubversionVCS(VersionControlSystem):
  """Implementation of the VersionControlSystem interface for Subversion."""

  def __init__(self, options):
    super(SubversionVCS, self).__init__(options)
    if self.options.revision:
      match = re.match(r"(\d+)(:(\d+))?", self.options.revision)
      if not match:
        ErrorExit("Invalid Subversion revision %s." % self.options.revision)
      self.rev_start = match.group(1)
      self.rev_end = match.group(3)
    else:
      self.rev_start = self.rev_end = None
    # Cache output from "svn list -r REVNO dirname".
    # Keys: dirname, Values: 2-tuple (ouput for start rev and end rev).
    self.svnls_cache = {}
    # Base URL is required to fetch files deleted in an older revision.
    # Result is cached to not guess it over and over again in GetBaseFile().
    required = self.options.download_base or self.options.revision is not None
    self.svn_base = self._GuessBase(required)

  def GetGUID(self):
    return self._GetInfo("Repository UUID")

  def GuessBase(self, required):
    """Wrapper for _GuessBase."""
    return self.svn_base

  def _GuessBase(self, required):
    """Returns base URL for current diff.

    Args:
      required: If true, exits if the url can't be guessed, otherwise None is
        returned.
    """
    url = self._GetInfo("URL")
    if url:
        scheme, netloc, path, params, query, fragment = urlparse.urlparse(url)
        guess = ""
        # TODO(anatoli) - repository specific hacks should be handled by server
        if netloc == "svn.python.org" and scheme == "svn+ssh":
          path = "projects" + path
          scheme = "http"
          guess = "Python "
        elif netloc.endswith(".googlecode.com"):
          scheme = "http"
          guess = "Google Code "
        path = path + "/"
        base = urlparse.urlunparse((scheme, netloc, path, params,
                                    query, fragment))
        logging.info("Guessed %sbase = %s", guess, base)
        return base
    if required:
      ErrorExit("Can't find URL in output from svn info")
    return None

  def _GetInfo(self, key):
    """Parses 'svn info' for current dir. Returns value for key or None"""
    for line in RunShell(["svn", "info"]).splitlines():
      if line.startswith(key + ": "):
        return line.split(":", 1)[1].strip()

  def _EscapeFilename(self, filename):
    """Escapes filename for SVN commands."""
    if "@" in filename and not filename.endswith("@"):
      filename = "%s@" % filename
    return filename

  def GenerateDiff(self, args):
    cmd = ["svn", "diff"]
    if self.options.revision:
      cmd += ["-r", self.options.revision]
    cmd.extend(args)
    data = RunShell(cmd)
    count = 0
    for line in data.splitlines():
      if line.startswith("Index:") or line.startswith("Property changes on:"):
        count += 1
        logging.info(line)
    if not count:
      ErrorExit("No valid patches found in output from svn diff")
    return data

  def _CollapseKeywords(self, content, keyword_str):
    """Collapses SVN keywords."""
    # svn cat translates keywords but svn diff doesn't. As a result of this
    # behavior patching.PatchChunks() fails with a chunk mismatch error.
    # This part was originally written by the Review Board development team
    # who had the same problem (http://reviews.review-board.org/r/276/).
    # Mapping of keywords to known aliases
    svn_keywords = {
      # Standard keywords
      'Date':                ['Date', 'LastChangedDate'],
      'Revision':            ['Revision', 'LastChangedRevision', 'Rev'],
      'Author':              ['Author', 'LastChangedBy'],
      'HeadURL':             ['HeadURL', 'URL'],
      'Id':                  ['Id'],

      # Aliases
      'LastChangedDate':     ['LastChangedDate', 'Date'],
      'LastChangedRevision': ['LastChangedRevision', 'Rev', 'Revision'],
      'LastChangedBy':       ['LastChangedBy', 'Author'],
      'URL':                 ['URL', 'HeadURL'],
    }

    def repl(m):
       if m.group(2):
         return "$%s::%s$" % (m.group(1), " " * len(m.group(3)))
       return "$%s$" % m.group(1)
    keywords = [keyword
                for name in keyword_str.split(" ")
                for keyword in svn_keywords.get(name, [])]
    return re.sub(r"\$(%s):(:?)([^\$]+)\$" % '|'.join(keywords), repl, content)

  def GetUnknownFiles(self):
    status = RunShell(["svn", "status", "--ignore-externals"], silent_ok=True)
    unknown_files = []
    for line in status.split("\n"):
      if line and line[0] == "?":
        unknown_files.append(line)
    return unknown_files

  def ReadFile(self, filename):
    """Returns the contents of a file."""
    file = open(filename, 'rb')
    result = ""
    try:
      result = file.read()
    finally:
      file.close()
    return result

  def GetStatus(self, filename):
    """Returns the status of a file."""
    if not self.options.revision:
      status = RunShell(["svn", "status", "--ignore-externals",
                         self._EscapeFilename(filename)])
      if not status:
        ErrorExit("svn status returned no output for %s" % filename)
      status_lines = status.splitlines()
      # If file is in a cl, the output will begin with
      # "\n--- Changelist 'cl_name':\n".  See
      # http://svn.collab.net/repos/svn/trunk/notes/changelist-design.txt
      if (len(status_lines) == 3 and
          not status_lines[0] and
          status_lines[1].startswith("--- Changelist")):
        status = status_lines[2]
      else:
        status = status_lines[0]
    # If we have a revision to diff against we need to run "svn list"
    # for the old and the new revision and compare the results to get
    # the correct status for a file.
    else:
      dirname, relfilename = os.path.split(filename)
      if dirname not in self.svnls_cache:
        cmd = ["svn", "list", "-r", self.rev_start,
               self._EscapeFilename(dirname) or "."]
        out, err, returncode = RunShellWithReturnCodeAndStderr(cmd)
        if returncode:
          # Directory might not yet exist at start revison
          # svn: Unable to find repository location for 'abc' in revision nnn
          if re.match('^svn: Unable to find repository location for .+ in revision \d+', err):
            old_files = ()
          else:
            ErrorExit("Failed to get status for %s:\n%s" % (filename, err))
        else:
          old_files = out.splitlines()
        args = ["svn", "list"]
        if self.rev_end:
          args += ["-r", self.rev_end]
        cmd = args + [self._EscapeFilename(dirname) or "."]
        out, returncode = RunShellWithReturnCode(cmd)
        if returncode:
          ErrorExit("Failed to run command %s" % cmd)
        self.svnls_cache[dirname] = (old_files, out.splitlines())
      old_files, new_files = self.svnls_cache[dirname]
      if relfilename in old_files and relfilename not in new_files:
        status = "D   "
      elif relfilename in old_files and relfilename in new_files:
        status = "M   "
      else:
        status = "A   "
    return status

  def GetBaseFile(self, filename):
    status = self.GetStatus(filename)
    base_content = None
    new_content = None

    # If a file is copied its status will be "A  +", which signifies
    # "addition-with-history".  See "svn st" for more information.  We need to
    # upload the original file or else diff parsing will fail if the file was
    # edited.
    if status[0] == "A" and status[3] != "+":
      # We'll need to upload the new content if we're adding a binary file
      # since diff's output won't contain it.
      mimetype = RunShell(["svn", "propget", "svn:mime-type",
                           self._EscapeFilename(filename)], silent_ok=True)
      base_content = ""
      is_binary = bool(mimetype) and not mimetype.startswith("text/")
      if is_binary and self.IsImage(filename):
        new_content = self.ReadFile(filename)
    elif (status[0] in ("M", "D", "R") or
          (status[0] == "A" and status[3] == "+") or  # Copied file.
          (status[0] == " " and status[1] == "M")):  # Property change.
      args = []
      if self.options.revision:
        # filename must not be escaped. We already add an ampersand here.
        url = "%s/%s@%s" % (self.svn_base, filename, self.rev_start)
      else:
        # Don't change filename, it's needed later.
        url = filename
        args += ["-r", "BASE"]
      cmd = ["svn"] + args + ["propget", "svn:mime-type", url]
      mimetype, returncode = RunShellWithReturnCode(cmd)
      if returncode:
        # File does not exist in the requested revision.
        # Reset mimetype, it contains an error message.
        mimetype = ""
      else:
        mimetype = mimetype.strip()
      get_base = False
      # this test for binary is exactly the test prescribed by the
      # official SVN docs at
      # http://subversion.apache.org/faq.html#binary-files
      is_binary = (bool(mimetype) and
        not mimetype.startswith("text/") and
        mimetype not in ("image/x-xbitmap", "image/x-xpixmap"))
      if status[0] == " ":
        # Empty base content just to force an upload.
        base_content = ""
      elif is_binary:
        if self.IsImage(filename):
          get_base = True
          if status[0] == "M":
            if not self.rev_end:
              new_content = self.ReadFile(filename)
            else:
              url = "%s/%s@%s" % (self.svn_base, filename, self.rev_end)
              new_content = RunShell(["svn", "cat", url],
                                     universal_newlines=True, silent_ok=True)
        else:
          base_content = ""
      else:
        get_base = True

      if get_base:
        if is_binary:
          universal_newlines = False
        else:
          universal_newlines = True
        if self.rev_start:
          # "svn cat -r REV delete_file.txt" doesn't work. cat requires
          # the full URL with "@REV" appended instead of using "-r" option.
          url = "%s/%s@%s" % (self.svn_base, filename, self.rev_start)
          base_content = RunShell(["svn", "cat", url],
                                  universal_newlines=universal_newlines,
                                  silent_ok=True)
        else:
          base_content, ret_code = RunShellWithReturnCode(
            ["svn", "cat", self._EscapeFilename(filename)],
            universal_newlines=universal_newlines)
          if ret_code and status[0] == "R":
            # It's a replaced file without local history (see issue208).
            # The base file needs to be fetched from the server.
            url = "%s/%s" % (self.svn_base, filename)
            base_content = RunShell(["svn", "cat", url],
                                    universal_newlines=universal_newlines,
                                    silent_ok=True)
          elif ret_code:
            ErrorExit("Got error status from 'svn cat %s'" % filename)
        if not is_binary:
          args = []
          if self.rev_start:
            url = "%s/%s@%s" % (self.svn_base, filename, self.rev_start)
          else:
            url = filename
            args += ["-r", "BASE"]
          cmd = ["svn"] + args + ["propget", "svn:keywords", url]
          keywords, returncode = RunShellWithReturnCode(cmd)
          if keywords and not returncode:
            base_content = self._CollapseKeywords(base_content, keywords)
    else:
      StatusUpdate("svn status returned unexpected output: %s" % status)
      sys.exit(1)
    return base_content, new_content, is_binary, status[0:5]


class GitVCS(VersionControlSystem):
  """Implementation of the VersionControlSystem interface for Git."""

  def __init__(self, options):
    super(GitVCS, self).__init__(options)
    # Map of filename -> (hash before, hash after) of base file.
    # Hashes for "no such file" are represented as None.
    self.hashes = {}
    # Map of new filename -> old filename for renames.
    self.renames = {}

  def GetGUID(self):
    revlist = RunShell("git rev-list --parents HEAD".split()).splitlines()
    # M-A: Return the 1st root hash, there could be multiple when a
    # subtree is merged. In that case, more analysis would need to
    # be done to figure out which HEAD is the 'most representative'.
    for r in revlist:
      if ' ' not in r:
        return r

  def PostProcessDiff(self, gitdiff):
    """Converts the diff output to include an svn-style "Index:" line as well
    as record the hashes of the files, so we can upload them along with our
    diff."""
    # Special used by git to indicate "no such content".
    NULL_HASH = "0"*40

    def IsFileNew(filename):
      return filename in self.hashes and self.hashes[filename][0] is None

    def AddSubversionPropertyChange(filename):
      """Add svn's property change information into the patch if given file is
      new file.

      We use Subversion's auto-props setting to retrieve its property.
      See http://svnbook.red-bean.com/en/1.1/ch07.html#svn-ch-7-sect-1.3.2 for
      Subversion's [auto-props] setting.
      """
      if self.options.emulate_svn_auto_props and IsFileNew(filename):
        svnprops = GetSubversionPropertyChanges(filename)
        if svnprops:
          svndiff.append("\n" + svnprops + "\n")

    svndiff = []
    filecount = 0
    filename = None
    for line in gitdiff.splitlines():
      match = re.match(r"diff --git a/(.*) b/(.*)$", line)
      if match:
        # Add auto property here for previously seen file.
        if filename is not None:
          AddSubversionPropertyChange(filename)
        filecount += 1
        # Intentionally use the "after" filename so we can show renames.
        filename = match.group(2)
        svndiff.append("Index: %s\n" % filename)
        if match.group(1) != match.group(2):
          self.renames[match.group(2)] = match.group(1)
      else:
        # The "index" line in a git diff looks like this (long hashes elided):
        #   index 82c0d44..b2cee3f 100755
        # We want to save the left hash, as that identifies the base file.
        match = re.match(r"index (\w+)\.\.(\w+)", line)
        if match:
          before, after = (match.group(1), match.group(2))
          if before == NULL_HASH:
            before = None
          if after == NULL_HASH:
            after = None
          self.hashes[filename] = (before, after)
      svndiff.append(line + "\n")
    if not filecount:
      ErrorExit("No valid patches found in output from git diff")
    # Add auto property for the last seen file.
    assert filename is not None
    AddSubversionPropertyChange(filename)
    return "".join(svndiff)

  def GenerateDiff(self, extra_args):
    extra_args = extra_args[:]
    if self.options.revision:
      if ":" in self.options.revision:
        extra_args = self.options.revision.split(":", 1) + extra_args
      else:
        extra_args = [self.options.revision] + extra_args

    # --no-ext-diff is broken in some versions of Git, so try to work around
    # this by overriding the environment (but there is still a problem if the
    # git config key "diff.external" is used).
    env = os.environ.copy()
    if 'GIT_EXTERNAL_DIFF' in env: del env['GIT_EXTERNAL_DIFF']
    return RunShell(
        [ "git", "diff", "--no-color", "--no-ext-diff", "--full-index",
          "--ignore-submodules", "-M"] + extra_args,
        env=env)

  def GetUnknownFiles(self):
    status = RunShell(["git", "ls-files", "--exclude-standard", "--others"],
                      silent_ok=True)
    return status.splitlines()

  def GetFileContent(self, file_hash, is_binary):
    """Returns the content of a file identified by its git hash."""
    data, retcode = RunShellWithReturnCode(["git", "show", file_hash],
                                            universal_newlines=not is_binary)
    if retcode:
      ErrorExit("Got error status from 'git show %s'" % file_hash)
    return data

  def GetBaseFile(self, filename):
    hash_before, hash_after = self.hashes.get(filename, (None,None))
    base_content = None
    new_content = None
    status = None

    if filename in self.renames:
      status = "A +"  # Match svn attribute name for renames.
      if filename not in self.hashes:
        # If a rename doesn't change the content, we never get a hash.
        base_content = RunShell(
            ["git", "show", "HEAD:" + filename], silent_ok=True)
    elif not hash_before:
      status = "A"
      base_content = ""
    elif not hash_after:
      status = "D"
    else:
      status = "M"

    is_binary = self.IsBinaryData(base_content)
    is_image = self.IsImage(filename)

    # Grab the before/after content if we need it.
    # We should include file contents if it's text or it's an image.
    if not is_binary or is_image:
      # Grab the base content if we don't have it already.
      if base_content is None and hash_before:
        base_content = self.GetFileContent(hash_before, is_binary)
      # Only include the "after" file if it's an image; otherwise it
      # it is reconstructed from the diff.
      if is_image and hash_after:
        new_content = self.GetFileContent(hash_after, is_binary)

    return (base_content, new_content, is_binary, status)


class CVSVCS(VersionControlSystem):
  """Implementation of the VersionControlSystem interface for CVS."""

  def __init__(self, options):
    super(CVSVCS, self).__init__(options)

  def GetGUID(self):
    """For now we don't know how to get repository ID for CVS"""
    return

  def GetOriginalContent_(self, filename):
    RunShell(["cvs", "up", filename], silent_ok=True)
    # TODO need detect file content encoding
    content = open(filename).read()
    return content.replace("\r\n", "\n")

  def GetBaseFile(self, filename):
    base_content = None
    new_content = None
    status = "A"

    output, retcode = RunShellWithReturnCode(["cvs", "status", filename])
    if retcode:
      ErrorExit("Got error status from 'cvs status %s'" % filename)

    if output.find("Status: Locally Modified") != -1:
      status = "M"
      temp_filename = "%s.tmp123" % filename
      os.rename(filename, temp_filename)
      base_content = self.GetOriginalContent_(filename)
      os.rename(temp_filename, filename)
    elif output.find("Status: Locally Added"):
      status = "A"
      base_content = ""
    elif output.find("Status: Needs Checkout"):
      status = "D"
      base_content = self.GetOriginalContent_(filename)

    return (base_content, new_content, self.IsBinaryData(base_content), status)

  def GenerateDiff(self, extra_args):
    cmd = ["cvs", "diff", "-u", "-N"]
    if self.options.revision:
      cmd += ["-r", self.options.revision]

    cmd.extend(extra_args)
    data, retcode = RunShellWithReturnCode(cmd)
    count = 0
    if retcode in [0, 1]:
      for line in data.splitlines():
        if line.startswith("Index:"):
          count += 1
          logging.info(line)

    if not count:
      ErrorExit("No valid patches found in output from cvs diff")

    return data

  def GetUnknownFiles(self):
    data, retcode = RunShellWithReturnCode(["cvs", "diff"])
    if retcode not in [0, 1]:
      ErrorExit("Got error status from 'cvs diff':\n%s" % (data,))
    unknown_files = []
    for line in data.split("\n"):
      if line and line[0] == "?":
        unknown_files.append(line)
    return unknown_files

class MercurialVCS(VersionControlSystem):
  """Implementation of the VersionControlSystem interface for Mercurial."""

  def __init__(self, options, repo_dir):
    super(MercurialVCS, self).__init__(options)
    # Absolute path to repository (we can be in a subdir)
    self.repo_dir = os.path.normpath(repo_dir)
    # Compute the subdir
    cwd = os.path.normpath(os.getcwd())
    assert cwd.startswith(self.repo_dir)
    self.subdir = cwd[len(self.repo_dir):].lstrip(r"\/")
    if self.options.revision:
      self.base_rev = self.options.revision
    else:
      self.base_rev = RunShell(["hg", "parent", "-q"]).split(':')[1].strip()

  def GetGUID(self):
    # See chapter "Uniquely identifying a repository"
    # http://hgbook.red-bean.com/read/customizing-the-output-of-mercurial.html
    info = RunShell("hg log -r0 --template {node}".split())
    return info.strip()

  def _GetRelPath(self, filename):
    """Get relative path of a file according to the current directory,
    given its logical path in the repo."""
    absname = os.path.join(self.repo_dir, filename)
    return os.path.relpath(absname)

  def GenerateDiff(self, extra_args):
    cmd = ["hg", "diff", "--git", "-r", self.base_rev] + extra_args
    data = RunShell(cmd, silent_ok=True)
    svndiff = []
    filecount = 0
    for line in data.splitlines():
      m = re.match("diff --git a/(\S+) b/(\S+)", line)
      if m:
        # Modify line to make it look like as it comes from svn diff.
        # With this modification no changes on the server side are required
        # to make upload.py work with Mercurial repos.
        # NOTE: for proper handling of moved/copied files, we have to use
        # the second filename.
        filename = m.group(2)
        svndiff.append("Index: %s" % filename)
        svndiff.append("=" * 67)
        filecount += 1
        logging.info(line)
      else:
        svndiff.append(line)
    if not filecount:
      ErrorExit("No valid patches found in output from hg diff")
    return "\n".join(svndiff) + "\n"

  def GetUnknownFiles(self):
    """Return a list of files unknown to the VCS."""
    args = []
    status = RunShell(["hg", "status", "--rev", self.base_rev, "-u", "."],
        silent_ok=True)
    unknown_files = []
    for line in status.splitlines():
      st, fn = line.split(" ", 1)
      if st == "?":
        unknown_files.append(fn)
    return unknown_files

  def GetBaseFile(self, filename):
    # "hg status" and "hg cat" both take a path relative to the current subdir,
    # but "hg diff" has given us the path relative to the repo root.
    base_content = ""
    new_content = None
    is_binary = False
    oldrelpath = relpath = self._GetRelPath(filename)
    # "hg status -C" returns two lines for moved/copied files, one otherwise
    out = RunShell(["hg", "status", "-C", "--rev", self.base_rev, relpath])
    out = out.splitlines()
    # HACK: strip error message about missing file/directory if it isn't in
    # the working copy
    if out[0].startswith('%s: ' % relpath):
      out = out[1:]
    status, _ = out[0].split(' ', 1)
    if len(out) > 1 and status == "A":
      # Moved/copied => considered as modified, use old filename to
      # retrieve base contents
      oldrelpath = out[1].strip()
      status = "M"
    if ":" in self.base_rev:
      base_rev = self.base_rev.split(":", 1)[0]
    else:
      base_rev = self.base_rev
    if status != "A":
      base_content = RunShell(["hg", "cat", "-r", base_rev, oldrelpath],
        silent_ok=True)
      is_binary = self.IsBinaryData(base_content)
    if status != "R":
      new_content = open(relpath, "rb").read()
      is_binary = is_binary or self.IsBinaryData(new_content)
    if is_binary and base_content:
      # Fetch again without converting newlines
      base_content = RunShell(["hg", "cat", "-r", base_rev, oldrelpath],
        silent_ok=True, universal_newlines=False)
    if not is_binary or not self.IsImage(relpath):
      new_content = None
    return base_content, new_content, is_binary, status


class PerforceVCS(VersionControlSystem):
  """Implementation of the VersionControlSystem interface for Perforce."""

  def __init__(self, options):

    def ConfirmLogin():
      # Make sure we have a valid perforce session
      while True:
        data, retcode = self.RunPerforceCommandWithReturnCode(
            ["login", "-s"], marshal_output=True)
        if not data:
          ErrorExit("Error checking perforce login")
        if not retcode and (not "code" in data or data["code"] != "error"):
          break
        print "Enter perforce password: "
        self.RunPerforceCommandWithReturnCode(["login"])

    super(PerforceVCS, self).__init__(options)

    self.p4_changelist = options.p4_changelist
    if not self.p4_changelist:
      ErrorExit("A changelist id is required")
    if (options.revision):
      ErrorExit("--rev is not supported for perforce")

    self.p4_port = options.p4_port
    self.p4_client = options.p4_client
    self.p4_user = options.p4_user

    ConfirmLogin()

    if not options.title:
      description = self.RunPerforceCommand(["describe", self.p4_changelist],
                                            marshal_output=True)
      if description and "desc" in description:
        # Rietveld doesn't support multi-line descriptions
        raw_title = description["desc"].strip()
        lines = raw_title.splitlines()
        if len(lines):
          options.title = lines[0]

  def GetGUID(self):
    """For now we don't know how to get repository ID for Perforce"""
    return

  def RunPerforceCommandWithReturnCode(self, extra_args, marshal_output=False,
                                       universal_newlines=True):
    args = ["p4"]
    if marshal_output:
      # -G makes perforce format its output as marshalled python objects
      args.extend(["-G"])
    if self.p4_port:
      args.extend(["-p", self.p4_port])
    if self.p4_client:
      args.extend(["-c", self.p4_client])
    if self.p4_user:
      args.extend(["-u", self.p4_user])
    args.extend(extra_args)

    data, retcode = RunShellWithReturnCode(
        args, print_output=False, universal_newlines=universal_newlines)
    if marshal_output and data:
      data = marshal.loads(data)
    return data, retcode

  def RunPerforceCommand(self, extra_args, marshal_output=False,
                         universal_newlines=True):
    # This might be a good place to cache call results, since things like
    # describe or fstat might get called repeatedly.
    data, retcode = self.RunPerforceCommandWithReturnCode(
        extra_args, marshal_output, universal_newlines)
    if retcode:
      ErrorExit("Got error status from %s:\n%s" % (extra_args, data))
    return data

  def GetFileProperties(self, property_key_prefix = "", command = "describe"):
    description = self.RunPerforceCommand(["describe", self.p4_changelist],
                                          marshal_output=True)

    changed_files = {}
    file_index = 0
    # Try depotFile0, depotFile1, ... until we don't find a match
    while True:
      file_key = "depotFile%d" % file_index
      if file_key in description:
        filename = description[file_key]
        change_type = description[property_key_prefix + str(file_index)]
        changed_files[filename] = change_type
        file_index += 1
      else:
        break
    return changed_files

  def GetChangedFiles(self):
    return self.GetFileProperties("action")

  def GetUnknownFiles(self):
    # Perforce doesn't detect new files, they have to be explicitly added
    return []

  def IsBaseBinary(self, filename):
    base_filename = self.GetBaseFilename(filename)
    return self.IsBinaryHelper(base_filename, "files")

  def IsPendingBinary(self, filename):
    return self.IsBinaryHelper(filename, "describe")

  def IsBinaryHelper(self, filename, command):
    file_types = self.GetFileProperties("type", command)
    if not filename in file_types:
      ErrorExit("Trying to check binary status of unknown file %s." % filename)
    # This treats symlinks, macintosh resource files, temporary objects, and
    # unicode as binary. See the Perforce docs for more details:
    # http://www.perforce.com/perforce/doc.current/manuals/cmdref/o.ftypes.html
    return not file_types[filename].endswith("text")

  def GetFileContent(self, filename, revision, is_binary):
    file_arg = filename
    if revision:
      file_arg += "#" + revision
    # -q suppresses the initial line that displays the filename and revision
    return self.RunPerforceCommand(["print", "-q", file_arg],
                                   universal_newlines=not is_binary)

  def GetBaseFilename(self, filename):
    actionsWithDifferentBases = [
        "move/add", # p4 move
        "branch", # p4 integrate (to a new file), similar to hg "add"
        "add", # p4 integrate (to a new file), after modifying the new file
    ]

    # We only see a different base for "add" if this is a downgraded branch
    # after a file was branched (integrated), then edited.
    if self.GetAction(filename) in actionsWithDifferentBases:
      # -Or shows information about pending integrations/moves
      fstat_result = self.RunPerforceCommand(["fstat", "-Or", filename],
                                             marshal_output=True)

      baseFileKey = "resolveFromFile0" # I think it's safe to use only file0
      if baseFileKey in fstat_result:
        return fstat_result[baseFileKey]

    return filename

  def GetBaseRevision(self, filename):
    base_filename = self.GetBaseFilename(filename)

    have_result = self.RunPerforceCommand(["have", base_filename],
                                          marshal_output=True)
    if "haveRev" in have_result:
      return have_result["haveRev"]

  def GetLocalFilename(self, filename):
    where = self.RunPerforceCommand(["where", filename], marshal_output=True)
    if "path" in where:
      return where["path"]

  def GenerateDiff(self, args):
    class DiffData:
      def __init__(self, perforceVCS, filename, action):
        self.perforceVCS = perforceVCS
        self.filename = filename
        self.action = action
        self.base_filename = perforceVCS.GetBaseFilename(filename)

        self.file_body = None
        self.base_rev = None
        self.prefix = None
        self.working_copy = True
        self.change_summary = None

    def GenerateDiffHeader(diffData):
      header = []
      header.append("Index: %s" % diffData.filename)
      header.append("=" * 67)

      if diffData.base_filename != diffData.filename:
        if diffData.action.startswith("move"):
          verb = "rename"
        else:
          verb = "copy"
        header.append("%s from %s" % (verb, diffData.base_filename))
        header.append("%s to %s" % (verb, diffData.filename))

      suffix = "\t(revision %s)" % diffData.base_rev
      header.append("--- " + diffData.base_filename + suffix)
      if diffData.working_copy:
        suffix = "\t(working copy)"
      header.append("+++ " + diffData.filename + suffix)
      if diffData.change_summary:
        header.append(diffData.change_summary)
      return header

    def GenerateMergeDiff(diffData, args):
      # -du generates a unified diff, which is nearly svn format
      diffData.file_body = self.RunPerforceCommand(
          ["diff", "-du", diffData.filename] + args)
      diffData.base_rev = self.GetBaseRevision(diffData.filename)
      diffData.prefix = ""

      # We have to replace p4's file status output (the lines starting
      # with +++ or ---) to match svn's diff format
      lines = diffData.file_body.splitlines()
      first_good_line = 0
      while (first_good_line < len(lines) and
            not lines[first_good_line].startswith("@@")):
        first_good_line += 1
      diffData.file_body = "\n".join(lines[first_good_line:])
      return diffData

    def GenerateAddDiff(diffData):
      fstat = self.RunPerforceCommand(["fstat", diffData.filename],
                                      marshal_output=True)
      if "headRev" in fstat:
        diffData.base_rev = fstat["headRev"] # Re-adding a deleted file
      else:
        diffData.base_rev = "0" # Brand new file
      diffData.working_copy = False
      rel_path = self.GetLocalFilename(diffData.filename)
      diffData.file_body = open(rel_path, 'r').read()
      # Replicate svn's list of changed lines
      line_count = len(diffData.file_body.splitlines())
      diffData.change_summary = "@@ -0,0 +1"
      if line_count > 1:
          diffData.change_summary += ",%d" % line_count
      diffData.change_summary += " @@"
      diffData.prefix = "+"
      return diffData

    def GenerateDeleteDiff(diffData):
      diffData.base_rev = self.GetBaseRevision(diffData.filename)
      is_base_binary = self.IsBaseBinary(diffData.filename)
      # For deletes, base_filename == filename
      diffData.file_body = self.GetFileContent(diffData.base_filename,
          None,
          is_base_binary)
      # Replicate svn's list of changed lines
      line_count = len(diffData.file_body.splitlines())
      diffData.change_summary = "@@ -1"
      if line_count > 1:
        diffData.change_summary += ",%d" % line_count
      diffData.change_summary += " +0,0 @@"
      diffData.prefix = "-"
      return diffData

    changed_files = self.GetChangedFiles()

    svndiff = []
    filecount = 0
    for (filename, action) in changed_files.items():
      svn_status = self.PerforceActionToSvnStatus(action)
      if svn_status == "SKIP":
        continue

      diffData = DiffData(self, filename, action)
      # Is it possible to diff a branched file? Stackoverflow says no:
      # http://stackoverflow.com/questions/1771314/in-perforce-command-line-how-to-diff-a-file-reopened-for-add
      if svn_status == "M":
        diffData = GenerateMergeDiff(diffData, args)
      elif svn_status == "A":
        diffData = GenerateAddDiff(diffData)
      elif svn_status == "D":
        diffData = GenerateDeleteDiff(diffData)
      else:
        ErrorExit("Unknown file action %s (svn action %s)." % \
                  (action, svn_status))

      svndiff += GenerateDiffHeader(diffData)

      for line in diffData.file_body.splitlines():
        svndiff.append(diffData.prefix + line)
      filecount += 1
    if not filecount:
      ErrorExit("No valid patches found in output from p4 diff")
    return "\n".join(svndiff) + "\n"

  def PerforceActionToSvnStatus(self, status):
    # Mirroring the list at http://permalink.gmane.org/gmane.comp.version-control.mercurial.devel/28717
    # Is there something more official?
    return {
            "add" : "A",
            "branch" : "A",
            "delete" : "D",
            "edit" : "M", # Also includes changing file types.
            "integrate" : "M",
            "move/add" : "M",
            "move/delete": "SKIP",
            "purge" : "D", # How does a file's status become "purge"?
            }[status]

  def GetAction(self, filename):
    changed_files = self.GetChangedFiles()
    if not filename in changed_files:
      ErrorExit("Trying to get base version of unknown file %s." % filename)

    return changed_files[filename]

  def GetBaseFile(self, filename):
    base_filename = self.GetBaseFilename(filename)
    base_content = ""
    new_content = None

    status = self.PerforceActionToSvnStatus(self.GetAction(filename))

    if status != "A":
      revision = self.GetBaseRevision(base_filename)
      if not revision:
        ErrorExit("Couldn't find base revision for file %s" % filename)
      is_base_binary = self.IsBaseBinary(base_filename)
      base_content = self.GetFileContent(base_filename,
                                         revision,
                                         is_base_binary)

    is_binary = self.IsPendingBinary(filename)
    if status != "D" and status != "SKIP":
      relpath = self.GetLocalFilename(filename)
      if is_binary and self.IsImage(relpath):
        new_content = open(relpath, "rb").read()

    return base_content, new_content, is_binary, status

# NOTE: The SplitPatch function is duplicated in engine.py, keep them in sync.
def SplitPatch(data):
  """Splits a patch into separate pieces for each file.

  Args:
    data: A string containing the output of svn diff.

  Returns:
    A list of 2-tuple (filename, text) where text is the svn diff output
      pertaining to filename.
  """
  patches = []
  filename = None
  diff = []
  for line in data.splitlines(True):
    new_filename = None
    if line.startswith('Index:'):
      unused, new_filename = line.split(':', 1)
      new_filename = new_filename.strip()
    elif line.startswith('Property changes on:'):
      unused, temp_filename = line.split(':', 1)
      # When a file is modified, paths use '/' between directories, however
      # when a property is modified '\' is used on Windows.  Make them the same
      # otherwise the file shows up twice.
      temp_filename = temp_filename.strip().replace('\\', '/')
      if temp_filename != filename:
        # File has property changes but no modifications, create a new diff.
        new_filename = temp_filename
    if new_filename:
      if filename and diff:
        patches.append((filename, ''.join(diff)))
      filename = new_filename
      diff = [line]
      continue
    if diff is not None:
      diff.append(line)
  if filename and diff:
    patches.append((filename, ''.join(diff)))
  return patches


def UploadSeparatePatches(issue, rpc_server, patchset, data, options):
  """Uploads a separate patch for each file in the diff output.

  Returns a list of [patch_key, filename] for each file.
  """
  patches = SplitPatch(data)
  rv = []
  for patch in patches:
    if len(patch[1]) > MAX_UPLOAD_SIZE:
      print ("Not uploading the patch for " + patch[0] +
             " because the file is too large.")
      continue
    form_fields = [("filename", patch[0])]
    if not options.download_base:
      form_fields.append(("content_upload", "1"))
    files = [("data", "data.diff", patch[1])]
    ctype, body = EncodeMultipartFormData(form_fields, files)
    url = "/%d/upload_patch/%d" % (int(issue), int(patchset))
    print "Uploading patch for " + patch[0]
    response_body = rpc_server.Send(url, body, content_type=ctype)
    lines = response_body.splitlines()
    if not lines or lines[0] != "OK":
      StatusUpdate("  --> %s" % response_body)
      sys.exit(1)
    rv.append([lines[1], patch[0]])
  return rv


def GuessVCSName(options):
  """Helper to guess the version control system.

  This examines the current directory, guesses which VersionControlSystem
  we're using, and returns an string indicating which VCS is detected.

  Returns:
    A pair (vcs, output).  vcs is a string indicating which VCS was detected
    and is one of VCS_GIT, VCS_MERCURIAL, VCS_SUBVERSION, VCS_PERFORCE,
    VCS_CVS, or VCS_UNKNOWN.
    Since local perforce repositories can't be easily detected, this method
    will only guess VCS_PERFORCE if any perforce options have been specified.
    output is a string containing any interesting output from the vcs
    detection routine, or None if there is nothing interesting.
  """
  for attribute, value in options.__dict__.iteritems():
    if attribute.startswith("p4") and value != None:
      return (VCS_PERFORCE, None)

  def RunDetectCommand(vcs_type, command):
    """Helper to detect VCS by executing command.

    Returns:
       A pair (vcs, output) or None. Throws exception on error.
    """
    try:
      out, returncode = RunShellWithReturnCode(command)
      if returncode == 0:
        return (vcs_type, out.strip())
    except OSError, (errcode, message):
      if errcode != errno.ENOENT:  # command not found code
        raise

  # Mercurial has a command to get the base directory of a repository
  # Try running it, but don't die if we don't have hg installed.
  # NOTE: we try Mercurial first as it can sit on top of an SVN working copy.
  res = RunDetectCommand(VCS_MERCURIAL, ["hg", "root"])
  if res != None:
    return res

  # Subversion from 1.7 has a single centralized .svn folder
  # ( see http://subversion.apache.org/docs/release-notes/1.7.html#wc-ng )
  # That's why we use 'svn info' instead of checking for .svn dir
  res = RunDetectCommand(VCS_SUBVERSION, ["svn", "info"])
  if res != None:
    return res

  # Git has a command to test if you're in a git tree.
  # Try running it, but don't die if we don't have git installed.
  res = RunDetectCommand(VCS_GIT, ["git", "rev-parse",
                                   "--is-inside-work-tree"])
  if res != None:
    return res

  # detect CVS repos use `cvs status && $? == 0` rules
  res = RunDetectCommand(VCS_CVS, ["cvs", "status"])
  if res != None:
    return res

  return (VCS_UNKNOWN, None)


def GuessVCS(options):
  """Helper to guess the version control system.

  This verifies any user-specified VersionControlSystem (by command line
  or environment variable).  If the user didn't specify one, this examines
  the current directory, guesses which VersionControlSystem we're using,
  and returns an instance of the appropriate class.  Exit with an error
  if we can't figure it out.

  Returns:
    A VersionControlSystem instance. Exits if the VCS can't be guessed.
  """
  vcs = options.vcs
  if not vcs:
    vcs = os.environ.get("CODEREVIEW_VCS")
  if vcs:
    v = VCS_ABBREVIATIONS.get(vcs.lower())
    if v is None:
      ErrorExit("Unknown version control system %r specified." % vcs)
    (vcs, extra_output) = (v, None)
  else:
    (vcs, extra_output) = GuessVCSName(options)

  if vcs == VCS_MERCURIAL:
    if extra_output is None:
      extra_output = RunShell(["hg", "root"]).strip()
    return MercurialVCS(options, extra_output)
  elif vcs == VCS_SUBVERSION:
    return SubversionVCS(options)
  elif vcs == VCS_PERFORCE:
    return PerforceVCS(options)
  elif vcs == VCS_GIT:
    return GitVCS(options)
  elif vcs == VCS_CVS:
    return CVSVCS(options)

  ErrorExit(("Could not guess version control system. "
             "Are you in a working copy directory?"))


def CheckReviewer(reviewer):
  """Validate a reviewer -- either a nickname or an email addres.

  Args:
    reviewer: A nickname or an email address.

  Calls ErrorExit() if it is an invalid email address.
  """
  if "@" not in reviewer:
    return  # Assume nickname
  parts = reviewer.split("@")
  if len(parts) > 2:
    ErrorExit("Invalid email address: %r" % reviewer)
  assert len(parts) == 2
  if "." not in parts[1]:
    ErrorExit("Invalid email address: %r" % reviewer)


def LoadSubversionAutoProperties():
  """Returns the content of [auto-props] section of Subversion's config file as
  a dictionary.

  Returns:
    A dictionary whose key-value pair corresponds the [auto-props] section's
      key-value pair.
    In following cases, returns empty dictionary:
      - config file doesn't exist, or
      - 'enable-auto-props' is not set to 'true-like-value' in [miscellany].
  """
  if os.name == 'nt':
    subversion_config = os.environ.get("APPDATA") + "\\Subversion\\config"
  else:
    subversion_config = os.path.expanduser("~/.subversion/config")
  if not os.path.exists(subversion_config):
    return {}
  config = ConfigParser.ConfigParser()
  config.read(subversion_config)
  if (config.has_section("miscellany") and
      config.has_option("miscellany", "enable-auto-props") and
      config.getboolean("miscellany", "enable-auto-props") and
      config.has_section("auto-props")):
    props = {}
    for file_pattern in config.options("auto-props"):
      props[file_pattern] = ParseSubversionPropertyValues(
        config.get("auto-props", file_pattern))
    return props
  else:
    return {}

def ParseSubversionPropertyValues(props):
  """Parse the given property value which comes from [auto-props] section and
  returns a list whose element is a (svn_prop_key, svn_prop_value) pair.

  See the following doctest for example.

  >>> ParseSubversionPropertyValues('svn:eol-style=LF')
  [('svn:eol-style', 'LF')]
  >>> ParseSubversionPropertyValues('svn:mime-type=image/jpeg')
  [('svn:mime-type', 'image/jpeg')]
  >>> ParseSubversionPropertyValues('svn:eol-style=LF;svn:executable')
  [('svn:eol-style', 'LF'), ('svn:executable', '*')]
  """
  key_value_pairs = []
  for prop in props.split(";"):
    key_value = prop.split("=")
    assert len(key_value) <= 2
    if len(key_value) == 1:
      # If value is not given, use '*' as a Subversion's convention.
      key_value_pairs.append((key_value[0], "*"))
    else:
      key_value_pairs.append((key_value[0], key_value[1]))
  return key_value_pairs


def GetSubversionPropertyChanges(filename):
  """Return a Subversion's 'Property changes on ...' string, which is used in
  the patch file.

  Args:
    filename: filename whose property might be set by [auto-props] config.

  Returns:
    A string like 'Property changes on |filename| ...' if given |filename|
      matches any entries in [auto-props] section. None, otherwise.
  """
  global svn_auto_props_map
  if svn_auto_props_map is None:
    svn_auto_props_map = LoadSubversionAutoProperties()

  all_props = []
  for file_pattern, props in svn_auto_props_map.items():
    if fnmatch.fnmatch(filename, file_pattern):
      all_props.extend(props)
  if all_props:
    return FormatSubversionPropertyChanges(filename, all_props)
  return None


def FormatSubversionPropertyChanges(filename, props):
  """Returns Subversion's 'Property changes on ...' strings using given filename
  and properties.

  Args:
    filename: filename
    props: A list whose element is a (svn_prop_key, svn_prop_value) pair.

  Returns:
    A string which can be used in the patch file for Subversion.

  See the following doctest for example.

  >>> print FormatSubversionPropertyChanges('foo.cc', [('svn:eol-style', 'LF')])
  Property changes on: foo.cc
  ___________________________________________________________________
  Added: svn:eol-style
     + LF
  <BLANKLINE>
  """
  prop_changes_lines = [
    "Property changes on: %s" % filename,
    "___________________________________________________________________"]
  for key, value in props:
    prop_changes_lines.append("Added: " + key)
    prop_changes_lines.append("   + " + value)
  return "\n".join(prop_changes_lines) + "\n"


def RealMain(argv, data=None):
  """The real main function.

  Args:
    argv: Command line arguments.
    data: Diff contents. If None (default) the diff is generated by
      the VersionControlSystem implementation returned by GuessVCS().

  Returns:
    A 2-tuple (issue id, patchset id).
    The patchset id is None if the base files are not uploaded by this
    script (applies only to SVN checkouts).
  """
  options, args = parser.parse_args(argv[1:])
  if options.help:
    if options.verbose < 2:
      # hide Perforce options
      parser.epilog = "Use '--help -v' to show additional Perforce options."
      parser.option_groups.remove(parser.get_option_group('--p4_port'))
    parser.print_help()
    sys.exit(0)

  global verbosity
  verbosity = options.verbose
  if verbosity >= 3:
    logging.getLogger().setLevel(logging.DEBUG)
  elif verbosity >= 2:
    logging.getLogger().setLevel(logging.INFO)

  vcs = GuessVCS(options)

  base = options.base_url
  if isinstance(vcs, SubversionVCS):
    # Guessing the base field is only supported for Subversion.
    # Note: Fetching base files may become deprecated in future releases.
    guessed_base = vcs.GuessBase(options.download_base)
    if base:
      if guessed_base and base != guessed_base:
        print "Using base URL \"%s\" from --base_url instead of \"%s\"" % \
            (base, guessed_base)
    else:
      base = guessed_base

  if not base and options.download_base:
    options.download_base = True
    logging.info("Enabled upload of base file")
  if not options.assume_yes:
    vcs.CheckForUnknownFiles()
  if data is None:
    data = vcs.GenerateDiff(args)
  data = vcs.PostProcessDiff(data)
  if options.print_diffs:
    print "Rietveld diff start:*****"
    print data
    print "Rietveld diff end:*****"
  files = vcs.GetBaseFiles(data)
  if verbosity >= 1:
    print "Upload server:", options.server, "(change with -s/--server)"
  rpc_server = GetRpcServer(options.server,
                            options.email,
                            options.host,
                            options.save_cookies,
                            options.account_type)
  form_fields = []

  repo_guid = vcs.GetGUID()
  if repo_guid:
    form_fields.append(("repo_guid", repo_guid))
  if base:
    b = urlparse.urlparse(base)
    username, netloc = urllib.splituser(b.netloc)
    if username:
      logging.info("Removed username from base URL")
      base = urlparse.urlunparse((b.scheme, netloc, b.path, b.params,
                                  b.query, b.fragment))
    form_fields.append(("base", base))
  if options.issue:
    form_fields.append(("issue", str(options.issue)))
  if options.email:
    form_fields.append(("user", options.email))
  if options.reviewers:
    for reviewer in options.reviewers.split(','):
      CheckReviewer(reviewer)
    form_fields.append(("reviewers", options.reviewers))
  if options.cc:
    for cc in options.cc.split(','):
      CheckReviewer(cc)
    form_fields.append(("cc", options.cc))

  # Process --message, --title and --file.
  message = options.message or ""
  title = options.title or ""
  if options.file:
    if options.message:
      ErrorExit("Can't specify both message and message file options")
    file = open(options.file, 'r')
    message = file.read()
    file.close()
  if options.issue:
    prompt = "Title describing this patch set: "
  else:
    prompt = "New issue subject: "
  title = (
      title or message.split('\n', 1)[0].strip() or raw_input(prompt).strip())
  if not title and not options.issue:
    ErrorExit("A non-empty title is required for a new issue")
  # For existing issues, it's fine to give a patchset an empty name. Rietveld
  # doesn't accept that so use a whitespace.
  title = title or " "
  if len(title) > 100:
    title = title[:99] + '…'
  if title and not options.issue:
    message = message or title

  form_fields.append(("subject", title))
  # If it's a new issue send message as description. Otherwise a new
  # message is created below on upload_complete.
  if message and not options.issue:
    form_fields.append(("description", message))

  # Send a hash of all the base file so the server can determine if a copy
  # already exists in an earlier patchset.
  base_hashes = ""
  for file, info in files.iteritems():
    if not info[0] is None:
      checksum = md5(info[0]).hexdigest()
      if base_hashes:
        base_hashes += "|"
      base_hashes += checksum + ":" + file
  form_fields.append(("base_hashes", base_hashes))
  if options.private:
    if options.issue:
      print "Warning: Private flag ignored when updating an existing issue."
    else:
      form_fields.append(("private", "1"))
  if options.send_patch:
    options.send_mail = True
  if not options.download_base:
    form_fields.append(("content_upload", "1"))
  if len(data) > MAX_UPLOAD_SIZE:
    print "Patch is large, so uploading file patches separately."
    uploaded_diff_file = []
    form_fields.append(("separate_patches", "1"))
  else:
    uploaded_diff_file = [("data", "data.diff", data)]
  ctype, body = EncodeMultipartFormData(form_fields, uploaded_diff_file)
  response_body = rpc_server.Send("/upload", body, content_type=ctype)
  patchset = None
  if not options.download_base or not uploaded_diff_file:
    lines = response_body.splitlines()
    if len(lines) >= 2:
      msg = lines[0]
      patchset = lines[1].strip()
      patches = [x.split(" ", 1) for x in lines[2:]]
    else:
      msg = response_body
  else:
    msg = response_body
  StatusUpdate(msg)
  if not response_body.startswith("Issue created.") and \
  not response_body.startswith("Issue updated."):
    sys.exit(0)
  issue = msg[msg.rfind("/")+1:]

  if not uploaded_diff_file:
    result = UploadSeparatePatches(issue, rpc_server, patchset, data, options)
    if not options.download_base:
      patches = result

  if not options.download_base:
    vcs.UploadBaseFiles(issue, rpc_server, patches, patchset, options, files)

  payload = {}  # payload for final request
  if options.send_mail:
    payload["send_mail"] = "yes"
    if options.send_patch:
      payload["attach_patch"] = "yes"
  if options.issue and message:
    payload["message"] = message
  payload = urllib.urlencode(payload)
  rpc_server.Send("/" + issue + "/upload_complete/" + (patchset or ""),
                  payload=payload)
  return issue, patchset


def main():
  try:
    logging.basicConfig(format=("%(asctime).19s %(levelname)s %(filename)s:"
                                "%(lineno)s %(message)s "))
    os.environ['LC_ALL'] = 'C'
    RealMain(sys.argv)
  except KeyboardInterrupt:
    print
    StatusUpdate("Interrupted.")
    sys.exit(1)


if __name__ == "__main__":
  main()
