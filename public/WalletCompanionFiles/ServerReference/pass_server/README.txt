#
#  README
#  Pass Server reference implementation
#
#  Copyright (c) 2012 Apple, Inc. All rights reserved.
#

This is a reference implementation for the Passbook web service api. 
This document is broken up into three main sections:
 - How to get setup with this reference implementation
 - Changing the gate of the sample pass
 - Sending push notifications

### Getting Started
You will need a handful of external resources to get this demo up and running.

# Certificate
You will need a certificate issued by WWDR's iOS Provisioning Portal. After adding this certificate to your keychain,
please export it as a .p12 file and copy it to data/Certificate/anythingYouWant.p12. Remember the
password you choose. You'll be asked for it later. You will also need a copy of the WWDR Intermediate certificate 
in a PEM file format. The certificate is listed as 'Apple Worldwide Developer Relations Certification Authority' 
in your keychain. Select the certificate and export it as a PEM and put it into the lib/data/Certificate folder.
If you do not have a copy of this certificate in your keychain, a copy can be downloaded from the iOS 
Developer Portal.

# Hostname
Your server and devices will need to be on the same network. The server 
will need a static IP, domain name or Bonjour name.

# Xcode
Xcode and the Xcode Command Line Tools are both required to compile 
the ruby gems listed in the next section. Xcode can be downloaded from 
the Mac App store. The Xcode Command Line Tools can be installed from the 
Xcode>Preferences menu under the Downloads tab. 

# Ruby version
This reference implementation is supported with the following versions of Ruby:
 - 1.8.7-p249
 - 1.9.2-p290
 - 1.9.3-p0
 - 1.9.3-p125

# Gems
This demo depends on the following external gems:
 - sinatra
 - rack
 - sequel
 - sqlite3
 - yaml
 - json
 - sign_pass
 - rubyzip

Use the following commands to install the gems
$> sudo gem install sinatra sequel sqlite3 rubyzip rack yaml json terminal-table

Make sure you are in the pass_server directory before running the following command.
$> sudo gem install lib/sign_pass-1.0.0.gem

# Setting up the reference server
The reference server setup script will guide you through setting up the reference server.
Please have handy your hostname and the passTypeIdentifier of your pass.
To run the script type:

$> lib/pass_server_ctl -s

This will create the database file, the tables needed and generate a sample pass entry that 
corresponds to the sample pass file.

# Starting the server
To start the server run the following command from inside the root folder of the demo (substitute Host IP):

$> rackup -p4567 -o <Host IP>

# Initially Downloading the pass
The pass can be initially downloaded from the following URL on a device or from a 
computer and emailed to a device (Please substitute Host IP). Note that this url does not conform to the API and lack  
security and authentication controls. This URL is for development purposes only, please 
protect your user's data.

http://<Host IP>:4567/pass.pkpass

As you create your own passes, they can be placed in the data/passes/<serial_number> folders
and then downloaded from http://<Host IP>:4567/<serial_number>.pkpass. Use the following command 
to add new passes to the database.

$> lib/pass_server_ctl -a serial_number,authentication_token,pass_type_id


### Changing the gate of the sample pass
Use the pass_server_ctl utility to change the gate and generate a new copy of the signed pass.
You will be prompted for your certificate password.

$> lib/pass_server_ctl -g


### Sending push notifications
A push notification script is included in the lib directory. Run the script with the following command, note that you will be prompted 
for your certificate's password.

$> lib/pass_server_ctl -n

This will use the database and send out push notifications to the devices for all registrations in the database.

