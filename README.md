# ESPER Photo Control
A node.js library for controlling the [multi-camera trigger boxes](https://www.esperhq.com/product/multiple-camera-trigger-triggerbox/) from [ESPER Design](https://www.esperhq.com/) (AKA Better Things LTD) via USB.

# WORK-IN-PROGRESS
This project is under active development and is not yet ready for external use. We will update with releases once we feal it is in a more mature state.

# Requirements
The library has the following requirements for use:
- System must be supported by [Node SerialPort](https://serialport.io/) which is used for low level USB-UART communication.
- Trigger Boxes need to be running firmware v1.3 (we recommend using [ESPER's control software](https://support.esperhq.com/support/solutions/articles/44001510286-download-triggerbox-software) to update)
- Any needed USB drivers should be installed as recommended by ESPER (here)[https://support.esperhq.com/support/solutions/articles/44001510366-set-up-procedure]

# Installation
We are targeting having this up as a standard NPM package and will update these instructions once it is published.

# Usage
We are attempting to create two interfaces:
- A high-level interface where the individual commands for the trigger boxes are predefined and the quirks of communicating with it are handled for you.
- A low-level interface that simply establishes a connection and let's you send any commands you like.

We hope to build the library in such a way that changes in behaviors and instruciton sets between firmware versions can be accounted for in the high-level interface without much effort.  However, the low-level interface is there to allow use of newer firmware or other changes without us having to build a new higher interface for it.
