#!/bin/sh
# Exit if any errors
set -e
cd /root/autoupdate
npm install
./autoupdate.js

