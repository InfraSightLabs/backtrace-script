[![Build Status](https://travis-ci.org/InfraSightLabs/backtrace-script.svg?branch=master)](https://travis-ci.org/InfraSightLabs/backtrace-script)
[![npm version](https://badge.fury.io/js/%40infrasightlabs%2Fbacktrace.svg)](https://badge.fury.io/js/%40infrasightlabs%2Fbacktrace)

# Backtrace

## Installing

For the latest stable version:

```
npm install @infrasightlabs/backtrace
```

## Usage

Include the script and specify a capture url:

```javascript
backtrace.configure.setCaptureUrl('http://example.com/capture');
```

or in the script tag:

```html
<script type="text/javascript" src="backtrace.js" data-capture-url="http://example.com/capture"></script>
```
