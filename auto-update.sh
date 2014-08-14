#!/bin/sh
# Exit if any errors
set -e
cd /root/autoupdate
npm install
/usr/local/bin/node autoupdate.js

