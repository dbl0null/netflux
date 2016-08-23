(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (factory((global.netflux = global.netflux || {})));
}(this, (function (exports) { 'use strict';

(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

},{}],2:[function(require,module,exports){
/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
 /* eslint-env node */

'use strict';

// Shimming starts here.
(function() {
  // Utils.
  var logging = require('./utils').log;
  var browserDetails = require('./utils').browserDetails;
  // Export to the adapter global object visible in the browser.
  module.exports.browserDetails = browserDetails;
  module.exports.extractVersion = require('./utils').extractVersion;
  module.exports.disableLog = require('./utils').disableLog;

  // Uncomment the line below if you want logging to occur, including logging
  // for the switch statement below. Can also be turned on in the browser via
  // adapter.disableLog(false), but then logging from the switch statement below
  // will not appear.
  // require('./utils').disableLog(false);

  // Browser shims.
  var chromeShim = require('./chrome/chrome_shim') || null;
  var edgeShim = require('./edge/edge_shim') || null;
  var firefoxShim = require('./firefox/firefox_shim') || null;
  var safariShim = require('./safari/safari_shim') || null;

  // Shim browser if found.
  switch (browserDetails.browser) {
    case 'opera': // fallthrough as it uses chrome shims
    case 'chrome':
      if (!chromeShim || !chromeShim.shimPeerConnection) {
        logging('Chrome shim is not included in this adapter release.');
        return;
      }
      logging('adapter.js shimming chrome.');
      // Export to the adapter global object visible in the browser.
      module.exports.browserShim = chromeShim;

      chromeShim.shimGetUserMedia();
      chromeShim.shimMediaStream();
      chromeShim.shimSourceObject();
      chromeShim.shimPeerConnection();
      chromeShim.shimOnTrack();
      break;
    case 'firefox':
      if (!firefoxShim || !firefoxShim.shimPeerConnection) {
        logging('Firefox shim is not included in this adapter release.');
        return;
      }
      logging('adapter.js shimming firefox.');
      // Export to the adapter global object visible in the browser.
      module.exports.browserShim = firefoxShim;

      firefoxShim.shimGetUserMedia();
      firefoxShim.shimSourceObject();
      firefoxShim.shimPeerConnection();
      firefoxShim.shimOnTrack();
      break;
    case 'edge':
      if (!edgeShim || !edgeShim.shimPeerConnection) {
        logging('MS edge shim is not included in this adapter release.');
        return;
      }
      logging('adapter.js shimming edge.');
      // Export to the adapter global object visible in the browser.
      module.exports.browserShim = edgeShim;

      edgeShim.shimGetUserMedia();
      edgeShim.shimPeerConnection();
      break;
    case 'safari':
      if (!safariShim) {
        logging('Safari shim is not included in this adapter release.');
        return;
      }
      logging('adapter.js shimming safari.');
      // Export to the adapter global object visible in the browser.
      module.exports.browserShim = safariShim;

      safariShim.shimGetUserMedia();
      break;
    default:
      logging('Unsupported browser!');
  }
})();

},{"./chrome/chrome_shim":3,"./edge/edge_shim":1,"./firefox/firefox_shim":5,"./safari/safari_shim":7,"./utils":8}],3:[function(require,module,exports){

/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
 /* eslint-env node */
'use strict';
var logging = require('../utils.js').log;
var browserDetails = require('../utils.js').browserDetails;

var chromeShim = {
  shimMediaStream: function() {
    window.MediaStream = window.MediaStream || window.webkitMediaStream;
  },

  shimOnTrack: function() {
    if (typeof window === 'object' && window.RTCPeerConnection && !('ontrack' in
        window.RTCPeerConnection.prototype)) {
      Object.defineProperty(window.RTCPeerConnection.prototype, 'ontrack', {
        get: function() {
          return this._ontrack;
        },
        set: function(f) {
          var self = this;
          if (this._ontrack) {
            this.removeEventListener('track', this._ontrack);
            this.removeEventListener('addstream', this._ontrackpoly);
          }
          this.addEventListener('track', this._ontrack = f);
          this.addEventListener('addstream', this._ontrackpoly = function(e) {
            // onaddstream does not fire when a track is added to an existing
            // stream. But stream.onaddtrack is implemented so we use that.
            e.stream.addEventListener('addtrack', function(te) {
              var event = new Event('track');
              event.track = te.track;
              event.receiver = {track: te.track};
              event.streams = [e.stream];
              self.dispatchEvent(event);
            });
            e.stream.getTracks().forEach(function(track) {
              var event = new Event('track');
              event.track = track;
              event.receiver = {track: track};
              event.streams = [e.stream];
              this.dispatchEvent(event);
            }.bind(this));
          }.bind(this));
        }
      });
    }
  },

  shimSourceObject: function() {
    if (typeof window === 'object') {
      if (window.HTMLMediaElement &&
        !('srcObject' in window.HTMLMediaElement.prototype)) {
        // Shim the srcObject property, once, when HTMLMediaElement is found.
        Object.defineProperty(window.HTMLMediaElement.prototype, 'srcObject', {
          get: function() {
            return this._srcObject;
          },
          set: function(stream) {
            var self = this;
            // Use _srcObject as a private property for this shim
            this._srcObject = stream;
            if (this.src) {
              URL.revokeObjectURL(this.src);
            }

            if (!stream) {
              this.src = '';
              return;
            }
            this.src = URL.createObjectURL(stream);
            // We need to recreate the blob url when a track is added or
            // removed. Doing it manually since we want to avoid a recursion.
            stream.addEventListener('addtrack', function() {
              if (self.src) {
                URL.revokeObjectURL(self.src);
              }
              self.src = URL.createObjectURL(stream);
            });
            stream.addEventListener('removetrack', function() {
              if (self.src) {
                URL.revokeObjectURL(self.src);
              }
              self.src = URL.createObjectURL(stream);
            });
          }
        });
      }
    }
  },

  shimPeerConnection: function() {
    // The RTCPeerConnection object.
    window.RTCPeerConnection = function(pcConfig, pcConstraints) {
      // Translate iceTransportPolicy to iceTransports,
      // see https://code.google.com/p/webrtc/issues/detail?id=4869
      logging('PeerConnection');
      if (pcConfig && pcConfig.iceTransportPolicy) {
        pcConfig.iceTransports = pcConfig.iceTransportPolicy;
      }

      var pc = new webkitRTCPeerConnection(pcConfig, pcConstraints);
      var origGetStats = pc.getStats.bind(pc);
      pc.getStats = function(selector, successCallback, errorCallback) {
        var self = this;
        var args = arguments;

        // If selector is a function then we are in the old style stats so just
        // pass back the original getStats format to avoid breaking old users.
        if (arguments.length > 0 && typeof selector === 'function') {
          return origGetStats(selector, successCallback);
        }

        var fixChromeStats_ = function(response) {
          var standardReport = {};
          var reports = response.result();
          reports.forEach(function(report) {
            var standardStats = {
              id: report.id,
              timestamp: report.timestamp,
              type: report.type
            };
            report.names().forEach(function(name) {
              standardStats[name] = report.stat(name);
            });
            standardReport[standardStats.id] = standardStats;
          });

          return standardReport;
        };

        // shim getStats with maplike support
        var makeMapStats = function(stats, legacyStats) {
          var map = new Map(Object.keys(stats).map(function(key) {
            return[key, stats[key]];
          }));
          legacyStats = legacyStats || stats;
          Object.keys(legacyStats).forEach(function(key) {
            map[key] = legacyStats[key];
          });
          return map;
        };

        if (arguments.length >= 2) {
          var successCallbackWrapper_ = function(response) {
            args[1](makeMapStats(fixChromeStats_(response)));
          };

          return origGetStats.apply(this, [successCallbackWrapper_,
              arguments[0]]);
        }

        // promise-support
        return new Promise(function(resolve, reject) {
          if (args.length === 1 && typeof selector === 'object') {
            origGetStats.apply(self, [
              function(response) {
                resolve(makeMapStats(fixChromeStats_(response)));
              }, reject]);
          } else {
            // Preserve legacy chrome stats only on legacy access of stats obj
            origGetStats.apply(self, [
              function(response) {
                resolve(makeMapStats(fixChromeStats_(response),
                    response.result()));
              }, reject]);
          }
        }).then(successCallback, errorCallback);
      };

      return pc;
    };
    window.RTCPeerConnection.prototype = webkitRTCPeerConnection.prototype;

    // wrap static methods. Currently just generateCertificate.
    if (webkitRTCPeerConnection.generateCertificate) {
      Object.defineProperty(window.RTCPeerConnection, 'generateCertificate', {
        get: function() {
          return webkitRTCPeerConnection.generateCertificate;
        }
      });
    }

    ['createOffer', 'createAnswer'].forEach(function(method) {
      var nativeMethod = webkitRTCPeerConnection.prototype[method];
      webkitRTCPeerConnection.prototype[method] = function() {
        var self = this;
        if (arguments.length < 1 || (arguments.length === 1 &&
            typeof arguments[0] === 'object')) {
          var opts = arguments.length === 1 ? arguments[0] : undefined;
          return new Promise(function(resolve, reject) {
            nativeMethod.apply(self, [resolve, reject, opts]);
          });
        }
        return nativeMethod.apply(this, arguments);
      };
    });

    // add promise support -- natively available in Chrome 51
    if (browserDetails.version < 51) {
      ['setLocalDescription', 'setRemoteDescription', 'addIceCandidate']
          .forEach(function(method) {
            var nativeMethod = webkitRTCPeerConnection.prototype[method];
            webkitRTCPeerConnection.prototype[method] = function() {
              var args = arguments;
              var self = this;
              var promise = new Promise(function(resolve, reject) {
                nativeMethod.apply(self, [args[0], resolve, reject]);
              });
              if (args.length < 2) {
                return promise;
              }
              return promise.then(function() {
                args[1].apply(null, []);
              },
              function(err) {
                if (args.length >= 3) {
                  args[2].apply(null, [err]);
                }
              });
            };
          });
    }

    // shim implicit creation of RTCSessionDescription/RTCIceCandidate
    ['setLocalDescription', 'setRemoteDescription', 'addIceCandidate']
        .forEach(function(method) {
          var nativeMethod = webkitRTCPeerConnection.prototype[method];
          webkitRTCPeerConnection.prototype[method] = function() {
            arguments[0] = new ((method === 'addIceCandidate') ?
                RTCIceCandidate : RTCSessionDescription)(arguments[0]);
            return nativeMethod.apply(this, arguments);
          };
        });

    // support for addIceCandidate(null)
    var nativeAddIceCandidate =
        RTCPeerConnection.prototype.addIceCandidate;
    RTCPeerConnection.prototype.addIceCandidate = function() {
      return arguments[0] === null ? Promise.resolve()
          : nativeAddIceCandidate.apply(this, arguments);
    };
  }
};


// Expose public methods.
module.exports = {
  shimMediaStream: chromeShim.shimMediaStream,
  shimOnTrack: chromeShim.shimOnTrack,
  shimSourceObject: chromeShim.shimSourceObject,
  shimPeerConnection: chromeShim.shimPeerConnection,
  shimGetUserMedia: require('./getusermedia')
};

},{"../utils.js":8,"./getusermedia":4}],4:[function(require,module,exports){
/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
 /* eslint-env node */
'use strict';
var logging = require('../utils.js').log;

// Expose public methods.
module.exports = function() {
  var constraintsToChrome_ = function(c) {
    if (typeof c !== 'object' || c.mandatory || c.optional) {
      return c;
    }
    var cc = {};
    Object.keys(c).forEach(function(key) {
      if (key === 'require' || key === 'advanced' || key === 'mediaSource') {
        return;
      }
      var r = (typeof c[key] === 'object') ? c[key] : {ideal: c[key]};
      if (r.exact !== undefined && typeof r.exact === 'number') {
        r.min = r.max = r.exact;
      }
      var oldname_ = function(prefix, name) {
        if (prefix) {
          return prefix + name.charAt(0).toUpperCase() + name.slice(1);
        }
        return (name === 'deviceId') ? 'sourceId' : name;
      };
      if (r.ideal !== undefined) {
        cc.optional = cc.optional || [];
        var oc = {};
        if (typeof r.ideal === 'number') {
          oc[oldname_('min', key)] = r.ideal;
          cc.optional.push(oc);
          oc = {};
          oc[oldname_('max', key)] = r.ideal;
          cc.optional.push(oc);
        } else {
          oc[oldname_('', key)] = r.ideal;
          cc.optional.push(oc);
        }
      }
      if (r.exact !== undefined && typeof r.exact !== 'number') {
        cc.mandatory = cc.mandatory || {};
        cc.mandatory[oldname_('', key)] = r.exact;
      } else {
        ['min', 'max'].forEach(function(mix) {
          if (r[mix] !== undefined) {
            cc.mandatory = cc.mandatory || {};
            cc.mandatory[oldname_(mix, key)] = r[mix];
          }
        });
      }
    });
    if (c.advanced) {
      cc.optional = (cc.optional || []).concat(c.advanced);
    }
    return cc;
  };

  var shimConstraints_ = function(constraints, func) {
    constraints = JSON.parse(JSON.stringify(constraints));
    if (constraints && constraints.audio) {
      constraints.audio = constraintsToChrome_(constraints.audio);
    }
    if (constraints && typeof constraints.video === 'object') {
      // Shim facingMode for mobile, where it defaults to "user".
      var face = constraints.video.facingMode;
      face = face && ((typeof face === 'object') ? face : {ideal: face});

      if ((face && (face.exact === 'user' || face.exact === 'environment' ||
                    face.ideal === 'user' || face.ideal === 'environment')) &&
          !(navigator.mediaDevices.getSupportedConstraints &&
            navigator.mediaDevices.getSupportedConstraints().facingMode)) {
        delete constraints.video.facingMode;
        if (face.exact === 'environment' || face.ideal === 'environment') {
          // Look for "back" in label, or use last cam (typically back cam).
          return navigator.mediaDevices.enumerateDevices()
          .then(function(devices) {
            devices = devices.filter(function(d) {
              return d.kind === 'videoinput';
            });
            var back = devices.find(function(d) {
              return d.label.toLowerCase().indexOf('back') !== -1;
            }) || (devices.length && devices[devices.length - 1]);
            if (back) {
              constraints.video.deviceId = face.exact ? {exact: back.deviceId} :
                                                        {ideal: back.deviceId};
            }
            constraints.video = constraintsToChrome_(constraints.video);
            logging('chrome: ' + JSON.stringify(constraints));
            return func(constraints);
          });
        }
      }
      constraints.video = constraintsToChrome_(constraints.video);
    }
    logging('chrome: ' + JSON.stringify(constraints));
    return func(constraints);
  };

  var shimError_ = function(e) {
    return {
      name: {
        PermissionDeniedError: 'NotAllowedError',
        ConstraintNotSatisfiedError: 'OverconstrainedError'
      }[e.name] || e.name,
      message: e.message,
      constraint: e.constraintName,
      toString: function() {
        return this.name + (this.message && ': ') + this.message;
      }
    };
  };

  var getUserMedia_ = function(constraints, onSuccess, onError) {
    shimConstraints_(constraints, function(c) {
      navigator.webkitGetUserMedia(c, onSuccess, function(e) {
        onError(shimError_(e));
      });
    });
  };

  navigator.getUserMedia = getUserMedia_;

  // Returns the result of getUserMedia as a Promise.
  var getUserMediaPromise_ = function(constraints) {
    return new Promise(function(resolve, reject) {
      navigator.getUserMedia(constraints, resolve, reject);
    });
  };

  if (!navigator.mediaDevices) {
    navigator.mediaDevices = {
      getUserMedia: getUserMediaPromise_,
      enumerateDevices: function() {
        return new Promise(function(resolve) {
          var kinds = {audio: 'audioinput', video: 'videoinput'};
          return MediaStreamTrack.getSources(function(devices) {
            resolve(devices.map(function(device) {
              return {label: device.label,
                      kind: kinds[device.kind],
                      deviceId: device.id,
                      groupId: ''};
            }));
          });
        });
      }
    };
  }

  // A shim for getUserMedia method on the mediaDevices object.
  // TODO(KaptenJansson) remove once implemented in Chrome stable.
  if (!navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia = function(constraints) {
      return getUserMediaPromise_(constraints);
    };
  } else {
    // Even though Chrome 45 has navigator.mediaDevices and a getUserMedia
    // function which returns a Promise, it does not accept spec-style
    // constraints.
    var origGetUserMedia = navigator.mediaDevices.getUserMedia.
        bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = function(cs) {
      return shimConstraints_(cs, function(c) {
        return origGetUserMedia(c).catch(function(e) {
          return Promise.reject(shimError_(e));
        });
      });
    };
  }

  // Dummy devicechange event methods.
  // TODO(KaptenJansson) remove once implemented in Chrome stable.
  if (typeof navigator.mediaDevices.addEventListener === 'undefined') {
    navigator.mediaDevices.addEventListener = function() {
      logging('Dummy mediaDevices.addEventListener called.');
    };
  }
  if (typeof navigator.mediaDevices.removeEventListener === 'undefined') {
    navigator.mediaDevices.removeEventListener = function() {
      logging('Dummy mediaDevices.removeEventListener called.');
    };
  }
};

},{"../utils.js":8}],5:[function(require,module,exports){
/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
 /* eslint-env node */
'use strict';

var browserDetails = require('../utils').browserDetails;

var firefoxShim = {
  shimOnTrack: function() {
    if (typeof window === 'object' && window.RTCPeerConnection && !('ontrack' in
        window.RTCPeerConnection.prototype)) {
      Object.defineProperty(window.RTCPeerConnection.prototype, 'ontrack', {
        get: function() {
          return this._ontrack;
        },
        set: function(f) {
          if (this._ontrack) {
            this.removeEventListener('track', this._ontrack);
            this.removeEventListener('addstream', this._ontrackpoly);
          }
          this.addEventListener('track', this._ontrack = f);
          this.addEventListener('addstream', this._ontrackpoly = function(e) {
            e.stream.getTracks().forEach(function(track) {
              var event = new Event('track');
              event.track = track;
              event.receiver = {track: track};
              event.streams = [e.stream];
              this.dispatchEvent(event);
            }.bind(this));
          }.bind(this));
        }
      });
    }
  },

  shimSourceObject: function() {
    // Firefox has supported mozSrcObject since FF22, unprefixed in 42.
    if (typeof window === 'object') {
      if (window.HTMLMediaElement &&
        !('srcObject' in window.HTMLMediaElement.prototype)) {
        // Shim the srcObject property, once, when HTMLMediaElement is found.
        Object.defineProperty(window.HTMLMediaElement.prototype, 'srcObject', {
          get: function() {
            return this.mozSrcObject;
          },
          set: function(stream) {
            this.mozSrcObject = stream;
          }
        });
      }
    }
  },

  shimPeerConnection: function() {
    if (typeof window !== 'object' || !(window.RTCPeerConnection ||
        window.mozRTCPeerConnection)) {
      return; // probably media.peerconnection.enabled=false in about:config
    }
    // The RTCPeerConnection object.
    if (!window.RTCPeerConnection) {
      window.RTCPeerConnection = function(pcConfig, pcConstraints) {
        if (browserDetails.version < 38) {
          // .urls is not supported in FF < 38.
          // create RTCIceServers with a single url.
          if (pcConfig && pcConfig.iceServers) {
            var newIceServers = [];
            for (var i = 0; i < pcConfig.iceServers.length; i++) {
              var server = pcConfig.iceServers[i];
              if (server.hasOwnProperty('urls')) {
                for (var j = 0; j < server.urls.length; j++) {
                  var newServer = {
                    url: server.urls[j]
                  };
                  if (server.urls[j].indexOf('turn') === 0) {
                    newServer.username = server.username;
                    newServer.credential = server.credential;
                  }
                  newIceServers.push(newServer);
                }
              } else {
                newIceServers.push(pcConfig.iceServers[i]);
              }
            }
            pcConfig.iceServers = newIceServers;
          }
        }
        return new mozRTCPeerConnection(pcConfig, pcConstraints);
      };
      window.RTCPeerConnection.prototype = mozRTCPeerConnection.prototype;

      // wrap static methods. Currently just generateCertificate.
      if (mozRTCPeerConnection.generateCertificate) {
        Object.defineProperty(window.RTCPeerConnection, 'generateCertificate', {
          get: function() {
            return mozRTCPeerConnection.generateCertificate;
          }
        });
      }

      window.RTCSessionDescription = mozRTCSessionDescription;
      window.RTCIceCandidate = mozRTCIceCandidate;
    }

    // shim away need for obsolete RTCIceCandidate/RTCSessionDescription.
    ['setLocalDescription', 'setRemoteDescription', 'addIceCandidate']
        .forEach(function(method) {
          var nativeMethod = RTCPeerConnection.prototype[method];
          RTCPeerConnection.prototype[method] = function() {
            arguments[0] = new ((method === 'addIceCandidate') ?
                RTCIceCandidate : RTCSessionDescription)(arguments[0]);
            return nativeMethod.apply(this, arguments);
          };
        });

    // support for addIceCandidate(null)
    var nativeAddIceCandidate =
        RTCPeerConnection.prototype.addIceCandidate;
    RTCPeerConnection.prototype.addIceCandidate = function() {
      return arguments[0] === null ? Promise.resolve()
          : nativeAddIceCandidate.apply(this, arguments);
    };

    // shim getStats with maplike support
    var makeMapStats = function(stats) {
      var map = new Map();
      Object.keys(stats).forEach(function(key) {
        map.set(key, stats[key]);
        map[key] = stats[key];
      });
      return map;
    };

    var nativeGetStats = RTCPeerConnection.prototype.getStats;
    RTCPeerConnection.prototype.getStats = function(selector, onSucc, onErr) {
      return nativeGetStats.apply(this, [selector || null])
        .then(function(stats) {
          return makeMapStats(stats);
        })
        .then(onSucc, onErr);
    };
  }
};

// Expose public methods.
module.exports = {
  shimOnTrack: firefoxShim.shimOnTrack,
  shimSourceObject: firefoxShim.shimSourceObject,
  shimPeerConnection: firefoxShim.shimPeerConnection,
  shimGetUserMedia: require('./getusermedia')
};

},{"../utils":8,"./getusermedia":6}],6:[function(require,module,exports){
/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
 /* eslint-env node */
'use strict';

var logging = require('../utils').log;
var browserDetails = require('../utils').browserDetails;

// Expose public methods.
module.exports = function() {
  var shimError_ = function(e) {
    return {
      name: {
        SecurityError: 'NotAllowedError',
        PermissionDeniedError: 'NotAllowedError'
      }[e.name] || e.name,
      message: {
        'The operation is insecure.': 'The request is not allowed by the ' +
        'user agent or the platform in the current context.'
      }[e.message] || e.message,
      constraint: e.constraint,
      toString: function() {
        return this.name + (this.message && ': ') + this.message;
      }
    };
  };

  // getUserMedia constraints shim.
  var getUserMedia_ = function(constraints, onSuccess, onError) {
    var constraintsToFF37_ = function(c) {
      if (typeof c !== 'object' || c.require) {
        return c;
      }
      var require = [];
      Object.keys(c).forEach(function(key) {
        if (key === 'require' || key === 'advanced' || key === 'mediaSource') {
          return;
        }
        var r = c[key] = (typeof c[key] === 'object') ?
            c[key] : {ideal: c[key]};
        if (r.min !== undefined ||
            r.max !== undefined || r.exact !== undefined) {
          require.push(key);
        }
        if (r.exact !== undefined) {
          if (typeof r.exact === 'number') {
            r. min = r.max = r.exact;
          } else {
            c[key] = r.exact;
          }
          delete r.exact;
        }
        if (r.ideal !== undefined) {
          c.advanced = c.advanced || [];
          var oc = {};
          if (typeof r.ideal === 'number') {
            oc[key] = {min: r.ideal, max: r.ideal};
          } else {
            oc[key] = r.ideal;
          }
          c.advanced.push(oc);
          delete r.ideal;
          if (!Object.keys(r).length) {
            delete c[key];
          }
        }
      });
      if (require.length) {
        c.require = require;
      }
      return c;
    };
    constraints = JSON.parse(JSON.stringify(constraints));
    if (browserDetails.version < 38) {
      logging('spec: ' + JSON.stringify(constraints));
      if (constraints.audio) {
        constraints.audio = constraintsToFF37_(constraints.audio);
      }
      if (constraints.video) {
        constraints.video = constraintsToFF37_(constraints.video);
      }
      logging('ff37: ' + JSON.stringify(constraints));
    }
    return navigator.mozGetUserMedia(constraints, onSuccess, function(e) {
      onError(shimError_(e));
    });
  };

  // Returns the result of getUserMedia as a Promise.
  var getUserMediaPromise_ = function(constraints) {
    return new Promise(function(resolve, reject) {
      getUserMedia_(constraints, resolve, reject);
    });
  };

  // Shim for mediaDevices on older versions.
  if (!navigator.mediaDevices) {
    navigator.mediaDevices = {getUserMedia: getUserMediaPromise_,
      addEventListener: function() { },
      removeEventListener: function() { }
    };
  }
  navigator.mediaDevices.enumerateDevices =
      navigator.mediaDevices.enumerateDevices || function() {
        return new Promise(function(resolve) {
          var infos = [
            {kind: 'audioinput', deviceId: 'default', label: '', groupId: ''},
            {kind: 'videoinput', deviceId: 'default', label: '', groupId: ''}
          ];
          resolve(infos);
        });
      };

  if (browserDetails.version < 41) {
    // Work around http://bugzil.la/1169665
    var orgEnumerateDevices =
        navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
    navigator.mediaDevices.enumerateDevices = function() {
      return orgEnumerateDevices().then(undefined, function(e) {
        if (e.name === 'NotFoundError') {
          return [];
        }
        throw e;
      });
    };
  }
  if (browserDetails.version < 49) {
    var origGetUserMedia = navigator.mediaDevices.getUserMedia.
        bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = function(c) {
      return origGetUserMedia(c).catch(function(e) {
        return Promise.reject(shimError_(e));
      });
    };
  }
  navigator.getUserMedia = function(constraints, onSuccess, onError) {
    if (browserDetails.version < 44) {
      return getUserMedia_(constraints, onSuccess, onError);
    }
    // Replace Firefox 44+'s deprecation warning with unprefixed version.
    console.warn('navigator.getUserMedia has been replaced by ' +
                 'navigator.mediaDevices.getUserMedia');
    navigator.mediaDevices.getUserMedia(constraints).then(onSuccess, onError);
  };
};

},{"../utils":8}],7:[function(require,module,exports){
/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
'use strict';
var safariShim = {
  // TODO: DrAlex, should be here, double check against LayoutTests
  // shimOnTrack: function() { },

  // TODO: once the back-end for the mac port is done, add.
  // TODO: check for webkitGTK+
  // shimPeerConnection: function() { },

  shimGetUserMedia: function() {
    navigator.getUserMedia = navigator.webkitGetUserMedia;
  }
};

// Expose public methods.
module.exports = {
  shimGetUserMedia: safariShim.shimGetUserMedia
  // TODO
  // shimOnTrack: safariShim.shimOnTrack,
  // shimPeerConnection: safariShim.shimPeerConnection
};

},{}],8:[function(require,module,exports){
/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
 /* eslint-env node */
'use strict';

var logDisabled_ = true;

// Utility methods.
var utils = {
  disableLog: function(bool) {
    if (typeof bool !== 'boolean') {
      return new Error('Argument type: ' + typeof bool +
          '. Please use a boolean.');
    }
    logDisabled_ = bool;
    return (bool) ? 'adapter.js logging disabled' :
        'adapter.js logging enabled';
  },

  log: function() {
    if (typeof window === 'object') {
      if (logDisabled_) {
        return;
      }
      if (typeof console !== 'undefined' && typeof console.log === 'function') {
        console.log.apply(console, arguments);
      }
    }
  },

  /**
   * Extract browser version out of the provided user agent string.
   *
   * @param {!string} uastring userAgent string.
   * @param {!string} expr Regular expression used as match criteria.
   * @param {!number} pos position in the version string to be returned.
   * @return {!number} browser version.
   */
  extractVersion: function(uastring, expr, pos) {
    var match = uastring.match(expr);
    return match && match.length >= pos && parseInt(match[pos], 10);
  },

  /**
   * Browser detector.
   *
   * @return {object} result containing browser and version
   *     properties.
   */
  detectBrowser: function() {
    // Returned result object.
    var result = {};
    result.browser = null;
    result.version = null;

    // Fail early if it's not a browser
    if (typeof window === 'undefined' || !window.navigator) {
      result.browser = 'Not a browser.';
      return result;
    }

    // Firefox.
    if (navigator.mozGetUserMedia) {
      result.browser = 'firefox';
      result.version = this.extractVersion(navigator.userAgent,
          /Firefox\/([0-9]+)\./, 1);

    // all webkit-based browsers
    } else if (navigator.webkitGetUserMedia) {
      // Chrome, Chromium, Webview, Opera, all use the chrome shim for now
      if (window.webkitRTCPeerConnection) {
        result.browser = 'chrome';
        result.version = this.extractVersion(navigator.userAgent,
          /Chrom(e|ium)\/([0-9]+)\./, 2);

      // Safari or unknown webkit-based
      // for the time being Safari has support for MediaStreams but not webRTC
      } else {
        // Safari UA substrings of interest for reference:
        // - webkit version:           AppleWebKit/602.1.25 (also used in Op,Cr)
        // - safari UI version:        Version/9.0.3 (unique to Safari)
        // - safari UI webkit version: Safari/601.4.4 (also used in Op,Cr)
        //
        // if the webkit version and safari UI webkit versions are equals,
        // ... this is a stable version.
        //
        // only the internal webkit version is important today to know if
        // media streams are supported
        //
        if (navigator.userAgent.match(/Version\/(\d+).(\d+)/)) {
          result.browser = 'safari';
          result.version = this.extractVersion(navigator.userAgent,
            /AppleWebKit\/([0-9]+)\./, 1);

        // unknown webkit-based browser
        } else {
          result.browser = 'Unsupported webkit-based browser ' +
              'with GUM support but no WebRTC support.';
          return result;
        }
      }

    // Edge.
    } else if (navigator.mediaDevices &&
        navigator.userAgent.match(/Edge\/(\d+).(\d+)$/)) {
      result.browser = 'edge';
      result.version = this.extractVersion(navigator.userAgent,
          /Edge\/(\d+).(\d+)$/, 2);

    // Default fallthrough: not supported.
    } else {
      result.browser = 'Not a supported browser.';
      return result;
    }

    return result;
  }
};

// Export.
module.exports = {
  log: utils.log,
  disableLog: utils.disableLog,
  browserDetails: utils.detectBrowser(),
  extractVersion: utils.extractVersion
};

},{}]},{},[2]);

function isBrowser () {
  if (typeof window === 'undefined' || (typeof process !== 'undefined' && process.title === 'node')) {
    return false
  }
  return true
}

/**
 * Service module includes {@link module:channelBuilder},
 * {@link module:webChannelManager} and {@link module:messageBuilder}.
 * Services are substitutable stateless objects. Each service is identified by
 * its class name and some of them can receive messages via `WebChannel` sent
 * by another service.
 *
 * @module service
 * @see module:channelBuilder
 * @see module:webChannelManager
 * @see module:messageBuilder
 */

/**
 * Default timeout for any pending request.
 * @type {number}
 */
const DEFAULT_REQUEST_TIMEOUT = 5000

/**
 * Pending request map. Pending request is when a service uses a Promise
 * which will be fulfilled or rejected somewhere else in code. For exemple when
 * a peer is waiting for a feedback from another peer before Promise has completed.
 * @type {external:Map}
 */
const temp = new Map()

/**
 * Each service must implement this interface.
 * @interface
 */
class ServiceInterface {

  /**
   * Timeout event handler
   * @callback ServiceInterface~onTimeout
   */

  constructor () {
    if (!temp.has(this.name)) {
      temp.set(this.name, new WeakMap())
    }
  }

  /**
   * Service name which corresponds to its class name.
   * @return {string} - Name
   */
  get name () {
    return this.constructor.name
  }

  /**
   * Add new pending request.
   * @param {WebChannel} wc - Web channel to which this request corresponds
   * @param {number} id - Identifer to which this request corresponds
   * @param {Object} data - Data to be available when getPendingRequest is called
   * @param {number} [timeout=DEFAULT_REQUEST_TIMEOUT] - Timeout in milliseconds
   * @param {ServiceInterface~onTimeout} [onTimeout=() => {}] - Timeout event handler
   */
  addPendingRequest (wc, id, data, timeout = DEFAULT_REQUEST_TIMEOUT, onTimeout = () => {}) {
    this.addTemp(wc, id, data)
    setTimeout(onTimeout, timeout)
  }

  /**
   * Get pending request corresponding to the specific WebChannel and identifier.
   * @param  {WebChannel} wc - Web channel
   * @param  {number} id - Identifier
   * @return {Object} - Javascript object corresponding to the one provided in
   * addPendingRequest function
   */
  getPendingRequest (wc, id) {
    return this.getTemp(wc, id)
  }

  addTemp (wc, id, data) {
    let currentServiceTemp = temp.get(this.name)
    let idMap
    if (currentServiceTemp.has(wc)) {
      idMap = currentServiceTemp.get(wc)
    } else {
      idMap = new Map()
      currentServiceTemp.set(wc, idMap)
    }
    idMap.set(id, data)
  }

  getTemp (wc, id) {
    return temp.get(this.name).get(wc).get(id)
  }

  deleteTemp (wc, id) {
    let currentServiceTemp = temp.get(this.name)
    let idMap = currentServiceTemp.get(wc)
    currentServiceTemp.get(wc).delete(id)
    if (idMap.size === 0) currentServiceTemp.delete(wc)
  }
}

/**
 * Web Channel Manager module is a submodule of {@link module:service} and the
 * main component of any Web Channel. It is responsible to preserve Web Channel
 * structure intact (i.e. all peers have the same vision of the Web Channel).
 * Among its duties are:
 *
 * - Add a new peer into Web Channel.
 * - Remove a peer from Web Channel.
 * - Send a broadcast message.
 * - Send a message to a particular peer.
 *
 * @module webChannelManager
 * @see FullyConnectedService
 */

/**
 * Connection service of the peer who received a message of this type should
 * establish connection with one or several peers.
 */
const CONNECT_WITH = 1
const CONNECT_WITH_FEEDBACK = 2
const THIS_CHANNEL_TO_JOINING_PEER = 3

const CONNECT_WITH_TIMEOUT = 5000

/**
 * Each Web Channel Manager Service must implement this interface.
 * @interface
 * @extends module:service~ServiceInterface
 */
class ManagerInterface extends ServiceInterface {

  constructor () {
    super()
  }

  onMessage (wc, channel, msg) {
    // console.log('[DEBUG] {webChannelManager} onMessage: ', msg)
    switch (msg.code) {
      case CONNECT_WITH:
        if (wc.isJoining()) {
          msg.joiningPeers.forEach((jp) => {
            wc.addJoiningPeer(jp.jpId, jp.intermediaryId)
            msg.peerIds.push(jp.jpId)
          })
        }
        // console.log('Me ' + wc.myId + ' should connect to ----> ', msg.peerIds)
        msg.peerIds = this.reUseIntermediaryChannelIfPossible(wc, msg.jpId, msg.peerIds)
        let failed = []
        if (msg.peerIds.length === 0) {
          wc.sendSrvMsg(this.name, msg.sender,
            {code: CONNECT_WITH_FEEDBACK, id: wc.myId, failed}
          )
        } else {
          // console.log('Me ' + wc.myId + ' should connect to ----> ' + msg.peerIds + '--reUseIntermediaryChannelIfPossible')
          let counter = 0
          let cBuilder = provide(CHANNEL_BUILDER)
          msg.peerIds.forEach((id) => {
            cBuilder.connectMeTo(wc, id)
              .then((channel) => {
                // console.log('PEER ' + wc.myId + ' CONNECTED TO ' + channel.peerId)
                counter++
                let jp = wc.getJoiningPeer(msg.jpId)
                jp.toAddList(channel)
                wc.sendSrvMsg(this.name, channel.peerId,
                  {code: THIS_CHANNEL_TO_JOINING_PEER,
                  jpId: msg.jpId,
                  intermediaryId: jp.intermediaryId,
                  toBeAdded: true},
                  channel
                )
                if (counter === msg.peerIds.length) {
                  wc.sendSrvMsg(this.name, msg.sender,
                    {code: CONNECT_WITH_FEEDBACK, id: wc.myId, failed}
                  )
                }
              })
              .catch((reason) => {
                counter++
                failed.push({id, reason})
                if (counter === msg.peerIds.length) {
                  wc.sendSrvMsg(this.name, msg.sender,
                    {code: CONNECT_WITH_FEEDBACK, id: wc.myId, failed}
                  )
                }
              })
          })
        }
        break
      case CONNECT_WITH_FEEDBACK:
        this.getPendingRequest(wc, msg.id).resolve()
        break
      case THIS_CHANNEL_TO_JOINING_PEER:
        let jp
        if (wc.hasJoiningPeer(msg.jpId)) {
          jp = wc.getJoiningPeer(msg.jpId)
        } else {
          jp = wc.addJoiningPeer(msg.jpId, msg.intermediaryId)
        }
        if (msg.toBeAdded) {
          jp.toAddList(channel)
        } else {
          jp.toRemoveList(channel)
        }
        break
    }
  }

  /**
   * Send a request to a peer asking him to establish a connection with some
   * peers. This function is used when a new peer is joining the *WebChannel*.
   * The request can be sent to the peer who is joining as well as other peers
   * who are already members of the *WebChannel*.
   *
   * @param  {WebChannel} wc - The Web Channel.
   * @param  {string} id - Id of the peer who will receive this request.
   * @param  {string} jpId - Joining peer id (it is possible that `id`=`jpId`).
   * @param  {string[]} peerIds - Ids of peers with whom `id` peer must established
*              connections.
   * @return {Promise} - Is resolved once some of the connections could be established. It is rejected when an error occured.
   */
  connectWith (wc, id, jpId, peerIds, jpIds) {
    let joiningPeers = []
    jpIds.forEach((id) => {
      let jp = wc.getJoiningPeer(id)
      joiningPeers.push({
        jpId: jp.id,
        intermediaryId: jp.intermediaryId
      })
    })
    wc.sendSrvMsg(this.name, id,
      {code: CONNECT_WITH, jpId: jpId, sender: wc.myId, peerIds, joiningPeers}
    )
    return new Promise((resolve, reject) => {
      let timeout = this.calculateConnectWithTimeout(peerIds.length)
      this.addPendingRequest(wc, id, {resolve, reject}, timeout,
        () => reject(`CONNECT_WITH_TIMEOUT (${timeout}ms)`)
      )
    })
  }

  calculateConnectWithTimeout (nbPeers) {
    if (nbPeers > 0) {
      return CONNECT_WITH_TIMEOUT + Math.log10(nbPeers)
    } else {
      return CONNECT_WITH_TIMEOUT
    }
  }

  reUseIntermediaryChannelIfPossible (wc, jpId, ids) {
    let intermidiaryChannel
    let peerIndex
    for (let jp of wc.getJoiningPeers()) {
      if (jp.intermediaryChannel !== null) {
        peerIndex = ids.indexOf(jp.intermediaryId)
        if (peerIndex === -1) {
          peerIndex = ids.indexOf(jp.id)
        }
        if (peerIndex !== -1) {
          intermidiaryChannel = jp.intermediaryChannel
          break
        }
      }
    }
    let jp = wc.getJoiningPeer(jpId)
    jp.toAddList(intermidiaryChannel)
    wc.sendSrvMsg(this.name, jp.intermediaryId,
      {code: THIS_CHANNEL_TO_JOINING_PEER,
        jpId,
        intermediaryId: jp.intermediaryId,
        toBeAdded: true},
      intermidiaryChannel
    )
    ids.splice(peerIndex, 1)
    return ids
  }

  /**
   * Adds a new peer into Web Channel.
   *
   * @abstract
   * @param  {Channel} ch - Channel to be added (it should has
   * the `webChannel` property).
   * @return {Promise} - Resolved once the channel has been succesfully added,
   * rejected otherwise.
   */
  add (ch) {
    throw new Error('Must be implemented by subclass!')
  }

  /**
   * Send a message to all peers in Web Channel.
   *
   * @abstract
   * @param  {WebChannel} wc - Web Channel where the message will be propagated.
   * @param  {string} data - Data in stringified JSON format to be send.
   */
  broadcast (wc, data) {
    throw new Error('Must be implemented by subclass!')
  }

  /**
   * Send a message to a particular peer in Web Channel.
   *
   * @abstract
   * @param  {string} id - Peer id.
   * @param  {WebChannel} wc - Web Channel where the message will be propagated.
   * @param  {string} data - Data in stringified JSON format to be send.
   */
  sendTo (id, wc, data) {
    throw new Error('Must be implemented by subclass!')
  }

  /**
   * Leave Web Channel.
   *
   * @abstract
   * @param  {WebChannel} wc - Web Channel to leave.
   */
  leave (wc) {
    throw new Error('Must be implemented by subclass!')
  }
}

/**
 * Fully connected web channel manager. Implements fully connected topology
 * network, when each peer is connected to each other.
 *
 * @extends module:webChannelManager~WebChannelManagerInterface
 */
class FullyConnectedService extends ManagerInterface {

  constructor () {
    super()
  }

  add (channel) {
    let wc = channel.webChannel
    let peerIds = new Set([wc.myId])
    let jpIds = new Set()
    wc.channels.forEach((c) => peerIds.add(c.peerId))
    wc.getJoiningPeers().forEach((jp) => {
      if (channel.peerId !== jp.id && !peerIds.has(jp.id)) {
        jpIds.add(jp.id)
      }
    })
    return this.connectWith(wc, channel.peerId, channel.peerId, [...peerIds], [...jpIds])
  }

  broadcast (webChannel, data) {
    let d
    for (let c of webChannel.channels) {
      d = !isBrowser() ? data.slice(0) : data
      c.send(d)
    }
  }

  sendTo (id, webChannel, data) {
    for (let c of webChannel.channels) {
      if (c.peerId === id) {
        c.send(data)
        return
      }
    }
  }

  leave (webChannel) {}
}

const message = new WeakMap()

class NodeCloseEvent {
  constructor (msg) {
    message.set(this, msg)
  }

  get message () {
    return message.get(this)
  }
}

const CONNECT_TIMEOUT = 4000
let src
let webRTCAvailable = true
if (isBrowser()) src = window
else {
  try {
    src = require('wrtc')
    src.CloseEvent = NodeCloseEvent
  } catch (err) {
    webRTCAvailable = false
  }
}
const RTCPeerConnection$1 = src.RTCPeerConnection
const RTCIceCandidate$1 = src.RTCIceCandidate
const CloseEvent = src.CloseEvent

/**
 * Ice candidate event handler.
 *
 * @callback WebRTCService~onCandidate
 * @param {external:RTCPeerConnectionIceEvent} evt - Event.
 */

/**
 * Session description event handler.
 *
 * @callback WebRTCService~onSDP
 * @param {external:RTCPeerConnectionIceEvent} evt - Event.
 */

/**
 * Data channel event handler.
 *
 * @callback WebRTCService~onChannel
 * @param {external:RTCPeerConnectionIceEvent} evt - Event.
 */

/**
 * Service class responsible to establish connections between peers via
 * `RTCDataChannel`.
 *
 * @see {@link external:RTCPeerConnection}
 * @extends module:channelBuilder~ChannelBuilderInterface
 */
class WebRTCService extends ServiceInterface {

  /**
   * WebRTCService constructor.
   *
   * @param  {Object} [options] - This service options.
   * @param  {Object} [options.signaling='ws://sigver-coastteam.rhcloud.com:8000'] -
   * Signaling server URL.
   * @param  {Object[]} [options.iceServers=[{urls: 'stun:23.21.150.121'},{urls: 'stun:stun.l.google.com:19302'},{urls: 'turn:numb.viagenie.ca', credential: 'webrtcdemo', username: 'louis%40mozilla.com'}]] - WebRTC options to setup which STUN
   * and TURN servers to be used.
   */
  constructor (options = {}) {
    super()
    this.defaults = {
      signaling: 'ws://sigver-coastteam.rhcloud.com:8000',
      iceServers: [
        {urls: 'stun:turn01.uswest.xirsys.com'}
      ]
    }
    this.settings = Object.assign({}, this.defaults, options)
  }

  onMessage (wc, ch, msg) {
    if ('offer' in msg) {
      let pc = this.createPeerConnection((candidate) => {
        wc.sendSrvMsg(this.name, msg.sender, {sender: wc.myId, candidate})
      })
      this.addTemp(wc, msg.sender, pc)
      Promise.all([
        this.createDataChannel(pc, false)
          .then((channel) => {
            let channelBuilderService = provide(CHANNEL_BUILDER)
            channelBuilderService.onChannel(wc, channel, true, msg.sender)
            this.deleteTemp(wc, msg.sender)
          }),
        this.createAnswer(pc, msg.offer)
          .then((answer) => wc.sendSrvMsg(this.name, msg.sender, {sender: wc.myId, answer}))
      ]).catch((err) => console.error(`Establish data channel (webChannel): ${err.message}`))
    } if ('answer' in msg) {
      let pc = this.getTemp(wc, msg.sender)
      pc.setRemoteDescription(msg.answer)
        .then(() => pc.addReceivedCandidates())
        .catch((err) => console.error(`Set answer (webChannel): ${err.message}`))
    } else if ('candidate' in msg) {
      this.addIceCandidate(this.getTemp(wc, msg.sender), msg.candidate)
    }
  }

  // Equivalent connectMeTo(wc, id)
  connectOverWebChannel (wc, id) {
    return new Promise((resolve, reject) => {
      setTimeout(reject, CONNECT_TIMEOUT, 'connectMeTo timeout')
      let sender = wc.myId
      let pc = this.createPeerConnection((candidate) => {
        wc.sendSrvMsg(this.name, id, {sender, candidate})
      })
      this.addTemp(wc, id, pc)
      this.createDataChannel(pc, true)
        .then((channel) => {
          this.deleteTemp(wc, id)
          resolve(channel)
        })
        .catch(reject)
      this.createOffer(pc)
        .then((offer) => wc.sendSrvMsg(this.name, id, {sender, offer}))
        .catch(reject)
    })
  }

  // Equivalent à open
  listenFromSignaling (ws, onChannel) {
    let connections = new Map()

    ws.onmessage = (evt) => {
      let msg = JSON.parse(evt.data)

      if ('id' in msg && 'data' in msg) {
        let pc
        if (connections.has(msg.id)) pc = connections.get(msg.id)
        else {
          pc = this.createPeerConnection((candidate) => {
            if (ws.readyState === 1) ws.send(JSON.stringify({id: msg.id, data: {candidate}}))
          })
          connections.set(msg.id, pc)
        }
        if ('offer' in msg.data) {
          Promise.all([
            this.createDataChannel(pc, false).then((channel) => {
              connections.delete(msg.id)
              onChannel(channel)
            }),
            this.createAnswer(pc, msg.data.offer)
              .then((answer) => ws.send(JSON.stringify({id: msg.id, data: {answer}})))
          ]).catch((err) => {
            console.error(`Establish data channel through signaling: ${err.message}`)
          })
        } else if ('candidate' in msg.data) {
          this.addIceCandidate(pc, msg.data.candidate)
        }
      }
    }
  }

  connectOverSignaling (ws, key, options = {}) {
    let pc = this.createPeerConnection((candidate) => {
      if (ws.readyState === 1) ws.send(JSON.stringify({data: {candidate}}))
    })
    return Promise.race([
      new Promise((resolve, reject) => {
        ws.onclose = (closeEvt) => reject(closeEvt.reason)
        ws.onmessage = (evt) => {
          let msg
          try {
            msg = JSON.parse(evt.data)
          } catch (err) {
            console.error(`Unsupported message type from the signaling server: ${evt.data}`)
          }

          if ('data' in msg) {
            if ('answer' in msg.data) {
              pc.setRemoteDescription(msg.data.answer)
                .then(() => pc.addReceivedCandidates())
                .catch((err) => {
                  console.error(`Set answer (signaling): ${err.message}`)
                  reject(err)
                })
            } else if ('candidate' in msg.data) {
              this.addIceCandidate(pc, msg.data.candidate)
            }
          } else if ('isKeyOk' in msg) {
            if (msg.isKeyOk) {
              this.createOffer(pc)
                .then(offer => ws.send(JSON.stringify({data: {offer}})))
                .catch(reject)
            } else reject('Provided key is not available')
          } else reject(`Unknown message from the signaling server: ${evt.data}`)
        }
        ws.send(JSON.stringify({join: key}))
      }),
      this.createDataChannel(pc, true)
    ])
  }

  /**
   * Creates a peer connection and generates an SDP offer.
   *
   * @param  {WebRTCService~onCandidate} onCandidate - Ice candidate event handler.
   * @param  {WebRTCService~onSDP} sendOffer - Session description event handler.
   * @param  {WebRTCService~onChannel} onChannel - Handler event when the data channel is ready.
   * @return {Promise} - Resolved when the offer has been succesfully created,
   * set as local description and sent to the peer.
   */
  createOffer (pc) {
    return pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .then(() => JSON.parse(JSON.stringify(pc.localDescription)))
  }

  /**
   * Creates a peer connection and generates an SDP answer.
   *
   * @param  {WebRTCService~onCandidate} onCandidate - Ice candidate event handler.
   * @param  {WebRTCService~onSDP} sendOffer - Session description event handler.
   * @param  {WebRTCService~onChannel} onChannel - Handler event when the data channel is ready.
   * @param  {Object} offer - Offer received from a peer.
   * @return {Promise} - Resolved when the offer has been succesfully created,
   * set as local description and sent to the peer.
   */
  createAnswer (pc, offer) {
    return pc.setRemoteDescription(offer)
      .then(() => {
        pc.addReceivedCandidates()
        return pc.createAnswer()
      })
      .then((answer) => pc.setLocalDescription(answer))
      .then(() => JSON.parse(JSON.stringify(pc.localDescription)))
  }

  /**
   * Creates an instance of `RTCPeerConnection` and sets `onicecandidate` event handler.
   *
   * @private
   * @param  {WebRTCService~onCandidate} onCandidate - Ice
   * candidate event handler.
   * @return {external:RTCPeerConnection} - Peer connection.
   */
  createPeerConnection (onCandidate) {
    let pc = new RTCPeerConnection$1({iceServers: this.settings.iceServers})
    pc.isRemoteDescriptionSet = false
    pc.candidates = []
    pc.addReceivedCandidates = () => {
      pc.isRemoteDescriptionSet = true
      for (let c of pc.candidates) this.addIceCandidate(pc, c)
    }
    pc.onicecandidate = (evt) => {
      if (evt.candidate !== null) {
        let candidate = {
          candidate: evt.candidate.candidate,
          sdpMid: evt.candidate.sdpMid,
          sdpMLineIndex: evt.candidate.sdpMLineIndex
        }
        onCandidate(candidate)
      }
    }
    return pc
  }

  createDataChannel (pc, isInitiator) {
    return new Promise((resolve, reject) => {
      let dc
      if (isInitiator) {
        dc = pc.createDataChannel(null)
        dc.onopen = (evt) => resolve(dc)
      } else {
        pc.ondatachannel = (dcEvt) => {
          dc = dcEvt.channel
          dcEvt.channel.onopen = (evt) => resolve(dc)
        }
      }
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'disconnected') {
          if (dc.onclose) dc.onclose(new CloseEvent(pc.iceConnectionState))
        }
      }
    })
  }

  addIceCandidate (pc, candidate) {
    if (pc.isRemoteDescriptionSet) {
      pc.addIceCandidate(new RTCIceCandidate$1(candidate))
        .catch((evt) => console.error(`Add ICE candidate: ${evt.message}`))
    } else pc.candidates.push(candidate)
  }
}

const WebSocket = isBrowser() ? window.WebSocket : require('ws')

const CONNECT_TIMEOUT$1 = 4000
const OPEN = WebSocket.OPEN

class WebSocketService extends ServiceInterface {

  constructor() { super() }

  /**
   * Creates WebSocket with server.
   * @param {string} url - Server url
   * @return {Promise} It is resolved once the WebSocket has been created and rejected otherwise
   */
  connect (url) {
    return new Promise((resolve, reject) => {
      try {
        let ws = new WebSocket(url)
        ws.onopen = () => resolve(ws)
        // Timeout for node (otherwise it will loop forever if incorrect address)
        setTimeout(() => {
          if (ws.readyState !== OPEN) {
            reject(`WebSocket connection timeout with ${url}`)
          }
        }, CONNECT_TIMEOUT$1)
      } catch (err) { reject(err.message) }
    })
  }

}

const NEW_CHANNEL = 'newChannel'

class ChannelBuilderService extends ServiceInterface {
  constructor (options = {}) {
    super()
    this.default = {
      host: '',
      port: 0
    }
    this.settings = Object.assign({}, this.defaults, options)
  }

  connectMeTo (wc, id) {
    return new Promise((resolve, reject) => {
      this.addPendingRequest(wc, id, {resolve, reject})
      let data = this.availableConnectors(wc)
      let connectors = data.connectors
      let host = data.host
      let port = data.port
      wc.sendSrvMsg(this.name, id, {connectors, sender: wc.myId, host, port, oneMsg: true})
    })
  }

  availableConnectors (wc) {
    let data = {}
    let connectors = []
    if (webRTCAvailable) connectors.push(WEBRTC)
    let host = wc.settings.host
    let port = wc.settings.port
    if (!isBrowser() && host !== undefined && port !== undefined) connectors.push(WEBSOCKET)
    data = {connectors, host, port}
    return data
  }

  onChannel (wc, channel, oneMsg, sender) {
    wc.initChannel(channel, sender)
      .then((channel) => {
        if (oneMsg) this.getPendingRequest(wc, sender).resolve(channel)
      })
  }

  onMessage (wc, channel, msg) {
    let availabled = msg.connectors
    let host = msg.host
    let port = msg.port
    let settings = Object.assign({}, wc.settings, {host, port})
    if (availabled.indexOf(WEBSOCKET) > -1) {
      // A Bot server send the message
      let cBuilder = provide(WEBSOCKET, settings)
      let url = 'ws://' + host + ':' + port
      // Try to connect in WebSocket
      cBuilder.connect(url)
        .then((channel) => {
          channel.send(JSON.stringify({code: NEW_CHANNEL, sender: wc.myId,
            wcId: wc.id, oneMsg: msg.oneMsg}))
          this.onChannel(wc, channel, !msg.oneMsg, msg.sender)
        })
        .catch(() => {
          cBuilder = provide(WEBRTC)
          cBuilder.connectOverWebChannel(wc, msg.sender)
            .then((channel) => {
              this.onChannel(wc, channel, !msg.oneMsg, msg.sender)
            })
        })
    } else {
      let data = this.availableConnectors(wc)
      let connectors = data.connectors
      let host = data.host
      let port = data.port
      if (connectors.indexOf(WEBSOCKET) > -1) {
        // The peer who send the message doesn't listen in WebSocket and i'm bot
        wc.sendSrvMsg(this.name, msg.sender, {connectors: [WEBRTC, WEBSOCKET],
          sender: wc.myId, host, port, oneMsg: false})
      } else {
        // The peer who send the message doesn't listen in WebSocket and doesn't listen too
        let cBuilder = provide(WEBRTC)
        cBuilder.connectOverWebChannel(wc, msg.sender)
          .then((channel) => this.onChannel(wc, channel, !msg.oneMsg, msg.sender))
      }
    }
  }
}

/**
 * Message builder module is responsible to build messages to send them over the
 * *WebChannel* and treat messages received by the *WebChannel*. It also manage
 * big messages (more then 16ko) sent by users. Internal messages are always less
 * 16ko.
 *
 * @module messageBuilder
 */
let src$1 = isBrowser() ? window : require('text-encoding')
const TextEncoder = src$1.TextEncoder
const TextDecoder = src$1.TextDecoder

/**
 * Maximum size of the user message sent over *Channel*. Is meant without metadata.
 * @type {number}
 */
const MAX_USER_MSG_SIZE = 16365

/**
 * User message offset in the array buffer. All data before are metadata.
 * @type {number}
 */
const USER_MSG_OFFSET = 19

/**
 * First index in the array buffer after header (which is the part of metadata).
 * @type {number}
 */
const HEADER_OFFSET = 9

/**
 * Maximum message id number.
 * @type {number}
 */
const MAX_MSG_ID_SIZE = 65535

/**
 * User allowed message type: {@link external:ArrayBuffer}
 * @type {number}
 */
const ARRAY_BUFFER_TYPE = 1

/**
 * User allowed message type: {@link external:Uint8Array}
 * @type {number}
 */
const U_INT_8_ARRAY_TYPE = 2

/**
 * User allowed message type: {@link external:String}
 * @type {number}
 */
const STRING_TYPE = 3

/**
 * User allowed message type: {@link external:Int8Array}
 * @type {number}
 */
const INT_8_ARRAY_TYPE = 4

/**
 * User allowed message type: {@link external:Uint8ClampedArray}
 * @type {number}
 */
const U_INT_8_CLAMPED_ARRAY_TYPE = 5

/**
 * User allowed message type: {@link external:Int16Array}
 * @type {number}
 */
const INT_16_ARRAY_TYPE = 6

/**
 * User allowed message type: {@link external:Uint16Array}
 * @type {number}
 */
const U_INT_16_ARRAY_TYPE = 7

/**
 * User allowed message type: {@link external:Int32Array}
 * @type {number}
 */
const INT_32_ARRAY_TYPE = 8

/**
 * User allowed message type: {@link external:Uint32Array}
 * @type {number}
 */
const U_INT_32_ARRAY_TYPE = 9

/**
 * User allowed message type: {@link external:Float32Array}
 * @type {number}
 */
const FLOAT_32_ARRAY_TYPE = 10

/**
 * User allowed message type: {@link external:Float64Array}
 * @type {number}
 */
const FLOAT_64_ARRAY_TYPE = 11

/**
 * User allowed message type: {@link external:DataView}
 * @type {number}
 */
const DATA_VIEW_TYPE = 12

/**
 * Buffer for big user messages.
 */
const buffers = new WeakMap()

/**
 * Message builder service class.
 */
class MessageBuilderService extends ServiceInterface {

  /**
   * @callback MessageBuilderService~Send
   * @param {external:ArrayBuffer} dataChunk - If the message is too big this
   * action would be executed for each data chunk until send whole message
   */

  /**
   * @callback MessageBuilderService~Receive
   * @param {external:ArrayBuffer|external:Uint8Array|external:String|
   * external:Int8Array|external:Uint8ClampedArray|external:Int16Array|
   * external:Uint16Array|external:Int32Array|external:Uint32Array|
   * external:Float32Array|external:Float64Array|external:DataView} data - Message.
   * Its type depends on what other
   */

  /**
   * Header of the metadata of the messages sent/received over the *WebChannel*.
   * @typedef {Object} MessageBuilderService~Header
   * @property {number} code - Message type code
   * @property {number} senderId - Id of the sender peer
   * @property {number} recipientId - Id of the recipient peer
   */

  constructor () {
    super()
  }

  /**
   * Prepare user message to be sent over the *WebChannel*
   * @param {external:ArrayBuffer|external:Uint8Array|external:String|
   * external:Int8Array|external:Uint8ClampedArray|external:Int16Array|
   * external:Uint16Array|external:Int32Array|external:Uint32Array|
   * external:Float32Array|external:Float64Array|external:DataView} data -
   * Message to be sent
   * @param {number} senderId - Id of the peer who sends this message
   * @param {number} recipientId - Id of the recipient peer
   * @param {MessageBuilderService~Send} action - Send callback executed for each
   * data chunk if the message is too big
   * @param {boolean} isBroadcast - Equals to true if this message would be
   * sent to all *WebChannel* members and false if only to one member
   */
  handleUserMessage (data, recipientId, action, isBroadcast = true) {
    let workingData = this.userDataToType(data)
    let dataUint8Array = workingData.content
    if (dataUint8Array.byteLength <= MAX_USER_MSG_SIZE) {
      let dataView = this.initHeader(1, recipientId,
        dataUint8Array.byteLength + USER_MSG_OFFSET
      )
      dataView.setUint32(HEADER_OFFSET, dataUint8Array.byteLength)
      dataView.setUint8(13, workingData.type)
      dataView.setUint8(14, isBroadcast ? 1 : 0)
      let resultUint8Array = new Uint8Array(dataView.buffer)
      resultUint8Array.set(dataUint8Array, USER_MSG_OFFSET)
      action(resultUint8Array.buffer)
    } else {
      const msgId = Math.ceil(Math.random() * MAX_MSG_ID_SIZE)
      const totalChunksNb = Math.ceil(dataUint8Array.byteLength / MAX_USER_MSG_SIZE)
      for (let chunkNb = 0; chunkNb < totalChunksNb; chunkNb++) {
        let currentChunkMsgByteLength = Math.min(
          MAX_USER_MSG_SIZE,
          dataUint8Array.byteLength - MAX_USER_MSG_SIZE * chunkNb
        )
        let dataView = this.initHeader(
          1,
          recipientId,
          USER_MSG_OFFSET + currentChunkMsgByteLength
        )
        dataView.setUint32(9, dataUint8Array.byteLength)
        dataView.setUint8(13, workingData.type)
        dataView.setUint8(14, isBroadcast ? 1 : 0)
        dataView.setUint16(15, msgId)
        dataView.setUint16(17, chunkNb)
        let resultUint8Array = new Uint8Array(dataView.buffer)
        let j = USER_MSG_OFFSET
        let startIndex = MAX_USER_MSG_SIZE * chunkNb
        let endIndex = startIndex + currentChunkMsgByteLength
        for (let i = startIndex; i < endIndex; i++) {
          resultUint8Array[j++] = dataUint8Array[i]
        }
        action(resultUint8Array.buffer)
      }
    }
  }

  /**
   * Build a message which can be then sent trough the *Channel*.
   * @param {number} code - One of the internal message type code (e.g. {@link
   * USER_DATA})
   * @param {Object} [data={}] - Message. Could be empty if the code is enough
   * @returns {external:ArrayBuffer} - Built message
   */
  msg (code, data = {}, recepientId = null) {
    let msgEncoded = (new TextEncoder()).encode(JSON.stringify(data))
    let msgSize = msgEncoded.byteLength + HEADER_OFFSET
    let dataView = this.initHeader(code, recepientId, msgSize)
    let fullMsg = new Uint8Array(dataView.buffer)
    fullMsg.set(msgEncoded, HEADER_OFFSET)
    return fullMsg.buffer
  }

  /**
   * Read user message which was prepared by another peer with
   * {@link MessageBuilderService#handleUserMessage} and sent.
   * @param {WebChannel} wc - WebChannel
   * @param {number} senderId - Id of the peer who sent this message
   * @param {external:ArrayBuffer} data - Message
   * @param {MessageBuilderService~Receive} action - Callback when the message is
   * ready
   */
  readUserMessage (wc, senderId, data, action) {
    let dataView = new DataView(data)
    let msgSize = dataView.getUint32(HEADER_OFFSET)
    let dataType = dataView.getUint8(13)
    let isBroadcast = dataView.getUint8(14)
    if (msgSize > MAX_USER_MSG_SIZE) {
      let msgId = dataView.getUint16(15)
      let chunk = dataView.getUint16(17)
      let buffer = this.getBuffer(wc, senderId, msgId)
      if (buffer === undefined) {
        this.setBuffer(wc, senderId, msgId,
          new Buffer(msgSize, data, chunk, (fullData) => {
            action(this.extractUserData(fullData, dataType), isBroadcast)
          })
        )
      } else {
        buffer.add(data, chunk)
      }
    } else {
      let dataArray = new Uint8Array(data)
      let userData = new Uint8Array(data.byteLength - USER_MSG_OFFSET)
      let j = USER_MSG_OFFSET
      for (let i in userData) {
        userData[i] = dataArray[j++]
      }
      action(this.extractUserData(userData.buffer, dataType), isBroadcast)
    }
  }

  /**
   * Read internal Netflux message.
   * @param {external:ArrayBuffer} data - Message
   * @returns {Object}
   */
  readInternalMessage (data) {
    let uInt8Array = new Uint8Array(data)
    return JSON.parse((new TextDecoder())
      .decode(uInt8Array.subarray(HEADER_OFFSET, uInt8Array.byteLength))
    )
  }

  /**
   * Extract header from the message. Each user message has a header which is
   * a part of the message metadata.
   * TODO: add header also to the internal messages.
   * @param {external:ArrayBuffer} data - Whole message
   * @returns {MessageBuilderService~Header}
   */
  readHeader (data) {
    let dataView = new DataView(data)
    return {
      code: dataView.getUint8(0),
      senderId: dataView.getUint32(1),
      recepientId: dataView.getUint32(5)
    }
  }

  /**
   * Complete header of the message to be sent by setting sender peer id.
   * @param  {external.ArrayBuffer} buffer - Message to be sent
   * @param  {number} senderId - Id of the sender peer
   */
  completeHeader (buffer, senderId) {
    new DataView(buffer).setInt32(1, senderId)
  }

  /**
   * Create an *ArrayBuffer* and fill in the header.
   * @private
   * @param {number} code - Message type code
   * @param {number} senderId - Sender peer id
   * @param {number} recipientId - Recipient peer id
   * @param {number} dataSize - Message size in bytes
   * @return {external:DataView} - Data view with initialized header
   */
  initHeader (code, recipientId, dataSize) {
    let dataView = new DataView(new ArrayBuffer(dataSize))
    dataView.setUint8(0, code)
    // dataView.setUint32(1, senderId)
    dataView.setUint32(5, recipientId)
    return dataView
  }

  /**
   * Netflux sends data in *ArrayBuffer*, but the user can send data in different
   * types. This function retrieve the inital message sent by the user.
   * @private
   * @param {external:ArrayBuffer} - Message as it was received by the *WebChannel*
   * @param {number} - Message type as it was defined by the user
   * @returns {external:ArrayBuffer|external:Uint8Array|external:String|
   * external:Int8Array|external:Uint8ClampedArray|external:Int16Array|
   * external:Uint16Array|external:Int32Array|external:Uint32Array|
   * external:Float32Array|external:Float64Array|external:DataView} - Initial
   * user message
   */
  extractUserData (buffer, type) {
    switch (type) {
      case ARRAY_BUFFER_TYPE:
        return buffer
      case U_INT_8_ARRAY_TYPE:
        return new Uint8Array(buffer)
      case STRING_TYPE:
        return new TextDecoder().decode(new Uint8Array(buffer))
      case INT_8_ARRAY_TYPE:
        return new Int8Array(buffer)
      case U_INT_8_CLAMPED_ARRAY_TYPE:
        return new Uint8ClampedArray(buffer)
      case INT_16_ARRAY_TYPE:
        return new Int16Array(buffer)
      case U_INT_16_ARRAY_TYPE:
        return new Uint16Array(buffer)
      case INT_32_ARRAY_TYPE:
        return new Int32Array(buffer)
      case U_INT_32_ARRAY_TYPE:
        return new Uint32Array(buffer)
      case FLOAT_32_ARRAY_TYPE:
        return new Float32Array(buffer)
      case FLOAT_64_ARRAY_TYPE:
        return new Float64Array(buffer)
      case DATA_VIEW_TYPE:
        return new DataView(buffer)
    }
  }

  /**
   * Identify the user message type.
   * @private
   * @param {external:ArrayBuffer|external:Uint8Array|external:String|
   * external:Int8Array|external:Uint8ClampedArray|external:Int16Array|
   * external:Uint16Array|external:Int32Array|external:Uint32Array|
   * external:Float32Array|external:Float64Array|external:DataView} - User message
   * @returns {number} - User message type
   */
  userDataToType (data) {
    let result = {}
    if (data instanceof ArrayBuffer) {
      result.type = ARRAY_BUFFER_TYPE
      result.content = new Uint8Array(data)
    } else if (data instanceof Uint8Array) {
      result.type = U_INT_8_ARRAY_TYPE
      result.content = data
    } else if (typeof data === 'string' || data instanceof String) {
      result.type = STRING_TYPE
      result.content = new TextEncoder().encode(data)
    } else {
      result.content = new Uint8Array(data.buffer)
      if (data instanceof Int8Array) {
        result.type = INT_8_ARRAY_TYPE
      } else if (data instanceof Uint8ClampedArray) {
        result.type = U_INT_8_CLAMPED_ARRAY_TYPE
      } else if (data instanceof Int16Array) {
        result.type = INT_16_ARRAY_TYPE
      } else if (data instanceof Uint16Array) {
        result.type = U_INT_16_ARRAY_TYPE
      } else if (data instanceof Int32Array) {
        result.type = INT_32_ARRAY_TYPE
      } else if (data instanceof Uint32Array) {
        result.type = U_INT_32_ARRAY_TYPE
      } else if (data instanceof Float32Array) {
        result.type = FLOAT_32_ARRAY_TYPE
      } else if (data instanceof Float64Array) {
        result.type = FLOAT_64_ARRAY_TYPE
      } else if (data instanceof DataView) {
        result.type = DATA_VIEW_TYPE
      } else {
        throw new Error('Unknown data object')
      }
    }
    return result
  }

  /**
   * Get the buffer.
   * @private
   * @param {WebChannel} wc - WebChannel
   * @param {number} peerId - Peer id
   * @param {number} msgId - Message id
   * @returns {Buffer|undefined} - Returns buffer if it was found and undefined
   * if not
   */
  getBuffer (wc, peerId, msgId) {
    let wcBuffer = buffers.get(wc)
    if (wcBuffer !== undefined) {
      let peerBuffer = wcBuffer.get(peerId)
      if (peerBuffer !== undefined) {
        return peerBuffer.get(msgId)
      }
    }
    return undefined
  }

  /**
   * Add a new buffer to the buffer array.
   * @private
   * @param {WebChannel} wc - WebChannel
   * @param {number} peerId - Peer id
   * @param {number} msgId - Message id
   * @param {Buffer} - buffer
   */
  setBuffer (wc, peerId, msgId, buffer) {
    let wcBuffer = buffers.get(wc)
    if (wcBuffer === undefined) {
      wcBuffer = new Map()
      buffers.set(wc, wcBuffer)
    }
    let peerBuffer = wcBuffer.get(peerId)
    if (peerBuffer === undefined) {
      peerBuffer = new Map()
      wcBuffer.set(peerId, peerBuffer)
    }
    peerBuffer.set(msgId, buffer)
  }
}

/**
 * Buffer class used when the user message exceeds the message size limit which
 * may be sent over a *Channel*. Each buffer is identified by *WebChannel* id,
 * peer id (who sends the big message) and message id (in case if the peer sends
 * more then 1 big message at a time).
 */
class Buffer {

  /**
   * @callback Buffer~onFullMessage
   * @param {external:ArrayBuffer} - The full message as it was initially sent
   * by user
   */

  /**
   * @param {number} fullDataSize - The total user message size
   * @param {external:ArrayBuffer} - The first chunk of the user message
   * @param {Buffer~onFullMessage} action - Callback to be executed when all
   * message chunks are received and thus the message is ready
   */
  constructor (fullDataSize, data, chunkNb, action) {
    this.fullData = new Uint8Array(fullDataSize)
    this.currentSize = 0
    this.action = action
    this.add(data, chunkNb)
  }

  /**
   * Add a chunk of message to the buffer.
   * @param {external:ArrayBuffer} data - Message chunk
   * @param {number} chunkNb - Number of the chunk
   */
  add (data, chunkNb) {
    let dataChunk = new Uint8Array(data)
    let dataChunkSize = data.byteLength
    this.currentSize += dataChunkSize - USER_MSG_OFFSET
    let index = chunkNb * MAX_USER_MSG_SIZE
    for (let i = USER_MSG_OFFSET; i < dataChunkSize; i++) {
      this.fullData[index++] = dataChunk[i]
    }
    if (this.currentSize === this.fullData.byteLength) {
      this.action(this.fullData.buffer)
    }
  }
}

/**
 * Service Provider module is a helper module for {@link module:service}. It is
 * responsible to instantiate all services. This module must be used to get
 * any service instance.
 * @module serviceProvider
 */

/**
 * Constant used to get an instance of {@link WebRTCService}.
 * @type {string}
 */
const WEBRTC = 'WebRTCService'

/**
 * Constant used to get an instance of {@link WebSocketService}.
 * @type {string}
 */
const WEBSOCKET = 'WebSocketService'

const CHANNEL_BUILDER = 'ChannelBuilderService'

/**
 * Constant used to get an instance of {@link FullyConnectedService}.
 * @type {string}
 */
const FULLY_CONNECTED = 'FullyConnectedService'

/**
 * Constant used to get an instance of {@link MessageBuilderService}. It is a
 * singleton service.
 * @type {string}
 */
const MESSAGE_BUILDER = 'MessageBuilderService'

/**
 * Contains services who are singletons.
 * @type {string}
 */
const services = new Map()

/**
 * Provides the service instance specified by `name`.
 *
 * @param  {(module:serviceProvider.MESSAGE_BUILDER|
 *          module:serviceProvider.WEBRTC|
            module:serviceProvider.WEBSOCKET|
 *          module:serviceProvider.FULLY_CONNECTED)} name - The service name.
 * @param  {Object} [options] - Any options that the service accepts.
 * @return {module:service~ServiceInterface} - Service instance.
 * @throws An error if the service name is unknown
 */
let provide = function (name, options = {}) {
  if (services.has(name)) {
    return services.get(name)
  }
  let service
  switch (name) {
    case WEBRTC:
      return new WebRTCService(options)
    case WEBSOCKET:
      return new WebSocketService(options)
    case CHANNEL_BUILDER:
      return new ChannelBuilderService(options)
    case FULLY_CONNECTED:
      service = new FullyConnectedService()
      services.set(name, service)
      return service
    case MESSAGE_BUILDER:
      service = new MessageBuilderService()
      services.set(name, service)
      return service
    default:
      throw new Error(`Unknown service name: "${name}"`)
  }
}

const msgBld$1 = provide(MESSAGE_BUILDER)

/**
 * Wrapper class for {@link external:RTCDataChannel} and
 * {@link external:WebSocket}.
 */
class Channel {

  /**
   * Creates *Channel* instance from existing data channel or web socket, assigns
   * it to the specified *WebChannel* and gives him an identifier.
   * @param {external:WebSocket|external:RTCDataChannel} - Data channel or web
   * socket
   * @param {WebChannel} - The *WebChannel* this channel will be part of
   * @param {number} peerId - Identifier of the peer who is at the other end of
   * this channel
   */
  constructor (channel, webChannel, peerId) {
    // FIXME:this does not work for WebSocket
    channel.binaryType = 'arraybuffer'

    /**
     * Data channel or web socket.
     * @private
     * @type {external:WebSocket|external:RTCDataChannel}
     */
    this.channel = channel

    /**
     * The *WebChannel* which this channel belongs to.
     * @type {WebChannel}
     */
    this.webChannel = webChannel

    /**
     * Identifier of the peer who is at the other end of this channel
     * @type {WebChannel}
     */
    this.peerId = peerId
  }

  /**
   * Configure this channel. Set up message, error and close event handlers.
   */
  config () {
    this.channel.onmessage = (msgEvt) => { this.webChannel.onChannelMessage(this, msgEvt.data) }
    this.channel.onerror = (evt) => { this.webChannel.onChannelError(evt) }
    this.channel.onclose = (evt) => { this.webChannel.onChannelClose(evt, this.peerId) }
  }

  /**
   * Send message over this channel. The message should be prepared beforhand by
   * the {@link MessageBuilderService}
   * @see {@link MessageBuilderService#msg}, {@link MessageBuilderService#handleUserMessage}
   * @param {external:ArrayBuffer} data - Message
   */
  send (data) {
    // if (this.channel.readyState !== 'closed' && new Int8Array(data).length !== 0) {
    if (this.channel.readyState !== 'closed') {
      try {
        msgBld$1.completeHeader(data, this.webChannel.myId)
        this.channel.send(data)
      } catch (err) {
        console.error(`Channel send: ${err.message}`)
      }
    }
  }

  /**
   * Close the channel.
   */
  close () {
    this.channel.close()
  }
}

/**
 * This class represents a temporary state of a peer, while he is about to join
 * the web channel. During the joining process every peer in the web channel
 * and the joining peer have an instance of this class with the same `id` and
 * `intermediaryId` attribute values. After the joining process has been finished
 * regardless of success, these instances will be deleted.
 */
class JoiningPeer {
  constructor (id, intermediaryId, intermediaryChannel) {
    /**
     * The joining peer id.
     *
     * @type {string}
     */
    this.id = id

    /**
     * The id of the peer who invited the joining peer to the web channel. It is
     * a member of the web channel and called an intermediary peer between the
     * joining peer and the web channel. The same value for all instances.
     *
     * @type {string}
     */
    this.intermediaryId = intermediaryId

    /**
     * The channel between the joining peer and intermediary peer. It is null
     * for every peer, but the joining and intermediary peers.
     *
     * @type {Channel}
     */
    this.intermediaryChannel = intermediaryChannel

    /**
     * This attribute is proper to each peer. Array of channels which will be
     * added to the current peer once the joining peer become the member of the
     * web channel.
     *
     * @type {Channel[]}
     */
    this.channelsToAdd = []

    /**
     * This attribute is proper to each peer. Array of channels which will be
     * closed with the current peer once the joining peer become the member of the
     * web channel.
     *
     * @type {Channel[]}
     */
    this.channelsToRemove = []
  }

  /**
   * Add channel to `channelsToAdd` array.
   *
   * @param  {Channel} channel - Channel to add.
   */
  toAddList (channel) {
    this.channelsToAdd[this.channelsToAdd.length] = channel
  }

  /**
   * Add channel to `channelsToRemove` array
   *
   * @param  {Channel} channel - Channel to add.
   */
  toRemoveList (channel) {
    this.channelsToAdd[this.channelsToAdd.length] = channel
  }
}

/**
 * This class represents a door of the *WebChannel* for this peer. If the door
 * is open, then clients can join the *WebChannel* through this peer, otherwise
 * they cannot.
 */
class WebChannelGate {

  /**
   * When the *WebChannel* is open, any clients should you this data to join
   * the *WebChannel*.
   * @typedef {Object} WebChannelGate~AccessData
   * @property {string} key - The unique key to join the *WebChannel*
   * @property {string} url - Signaling server url
   */

  /**
   * @typedef {Object} WebChannelGate~AccessData
   * @property {string} key - The unique key to join the *WebChannel*
   * @property {string} url - Signaling server url
   */

  /**
   * @param {WebChannelGate~onClose} onClose - close event handler
   */
  constructor (onClose = () => {}) {
    /**
     * Web socket which holds the connection with the signaling server.
     * @private
     * @type {external:WebSocket}
     */
    this.ws = null

    /**
     * // TODO: add doc
     * @type {WebChannelGate~AccessData}
     */
    this.accessData = {}

    /**
     * Close event handler.
     * @private
     * @type {WebChannelGate~onClose}
     */
    this.onClose = onClose
  }

  /**
   * Open the door.
   * @param {external:WebSocket} socket - Web socket to signalign server
   * @param {WebChannelGate~AccessData} accessData - Access data to join the
   * *WebChannel
   */
  open (onChannel, options) {
    let url = options.signaling

    return new Promise((resolve, reject) => {
      let webRTCService = provide(WEBRTC)
      let webSocketService = provide(WEBSOCKET)
      let key = 'key' in options ? options.key : this.generateKey()
      webSocketService.connect(url)
        .then((ws) => {
          ws.onclose = (closeEvt) => {
            reject(closeEvt.reason)
            this.onClose(closeEvt)
          }
          ws.onerror = (err) => reject(err.message)
          ws.onmessage = (evt) => {
            let msg
            try {
              msg = JSON.parse(evt.data)
            } catch (err) {
              reject('Server responce is not a JSON string: ' + err.message)
            }
            if ('isKeyOk' in msg) {
              if (msg.isKeyOk) {
                webRTCService.listenFromSignaling(ws, onChannel)

                resolve(this.accessData)
              } else {
                reject(`The key: ${key} is not suitable`)
              }
            } else {
              reject(`Unknown server message: ${evt.data}`)
            }
          }
          this.ws = ws
          this.accessData.key = key
          this.accessData.url = url
          ws.send(JSON.stringify({key}))
        })
        .catch(reject)
    })
  }

  /**
   * Check if the door is opened or closed.
   * @returns {boolean} - Returns true if the door is opened and false if it is
   * closed
   */
  isOpen () {
    return this.ws !== null && this.ws.readyState === OPEN
  }

  /**
   * Close the door if it is open and do nothing if it is closed already.
   */
  close () {
    if (this.isOpen()) {
      this.ws.close()
      this.accessData = {}
      this.ws = null
    }
  }

  /**
   * Generate random key which will be used to join the *WebChannel*.
   * @private
   * @returns {string} - Generated key
   */
  generateKey () {
    const MIN_LENGTH = 5
    const DELTA_LENGTH = 0
    const MASK = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    const length = MIN_LENGTH + Math.round(Math.random() * DELTA_LENGTH)

    for (let i = 0; i < length; i++) {
      result += MASK[Math.round(Math.random() * (MASK.length - 1))]
    }
    return result
  }
}

const msgBld = provide(MESSAGE_BUILDER)

/**
 * Maximum identifier number for {@link WebChannel#generateId} function.
 * @type {number}
 */
const MAX_ID = 4294967295

/**
 * Timout for ping *WebChannel* in milliseconds.
 * @type {number}
 */
const PING_TIMEOUT = 5000

/**
 * One of the internal message type. It's a peer message.
 * @type {number}
 */
const USER_DATA = 1

/**
 * One of the internal message type. This message should be threated by a
 * specific service class.
 * @type {number}
 */
const SERVICE_DATA = 2

/**
 * One of the internal message type. Means a peer has left the *WebChannel*.
 * @type {number}
 */
const LEAVE = 3

/**
 * One of the internal message type. Initialization message for the joining peer.
 * @type {number}
 */

const JOIN_INIT = 4

/**
 * One of the internal message type. The message is intended for the *WebChannel*
 * members to notify them about the joining peer.
 * @type {number}
 */
const JOIN_NEW_MEMBER = 5

/**
 * One of the internal message type. The message is intended for the *WebChannel*
 * members to notify them that the joining peer has not succeed.
 * @type {number}
 */
const REMOVE_NEW_MEMBER = 6

/**
 * One of the internal message type. The message is intended for the joining peer
 * to notify him that everything is ready and he may join the *WebChannel*.
 * @type {number}
 */
const JOIN_FINILIZE = 7

/**
 * One of the internal message type. The message sent by the joining peer to
 * notify all *WebChannel* members about his arrivel.
 * @type {number}
 */
const JOIN_SUCCESS = 8

// /**
//  * One of the internal message type. This message is sent during Initialization
//  * of a channel.
//  * @see {@link WebChannel#initChannel}
//  * @type {number}
//  */
// const INIT_CHANNEL_PONG = 10

const INIT_OK = 10

/**
 * One of the internal message type. Ping message.
 * @type {number}
 */
const PING = 11

/**
 * One of the internal message type. Pong message, response to the ping message.
 * @type {number}
 */
const PONG = 12

const MEMBERS = 13

/**
 * Constant used to send a message to the server in order that
 * he can join the webcahnnel
 * @type {string}
 */
const ADD_BOT_SERVER = 'addBotServer'

/**
 * This class is an API starting point. It represents a group of collaborators
 * also called peers. Each peer can send/receive broadcast as well as personal
 * messages. Every peer in the *WebChannel* can invite another person to join
 * the *WebChannel* and he also possess enough information to be able to add it
 * preserving the current *WebChannel* structure (network topology).
 */
class WebChannel {

  /**
   * When the *WebChannel* is open, any clients should you this data to join
   * the *WebChannel*.
   * @typedef {Object} WebChannel~AccessData
   * @property {string} key - The unique key to join the *WebChannel*
   * @property {string} url - Signaling server url
   */

  /**
   * *WebChannel* constructor. *WebChannel* can be parameterized in terms of
   * network topology and connector technology (WebRTC or WebSocket. Currently
   * WebRTC is only available).
   * @param  {Object} [options] *WebChannel* configuration.
   * @param  {string} [options.topology=FULLY_CONNECTED] Defines the network
   *            topology.
   * @param  {string} [options.connector=WEBRTC] Determines the connection
   *            technology to use for build *WebChannel*.
   * @returns {WebChannel} Empty *WebChannel* without any connection.
   */
  constructor (options = {}) {
    this.defaults = {
      connector: WEBRTC,
      topology: FULLY_CONNECTED,
      signaling: 'wss://sigver-coastteam.rhcloud.com:8443'
    }
    this.settings = Object.assign({}, this.defaults, options)

    /**
     * Channels through which this peer is connected with other peers. This
     * attribute depends on the *WebChannel* topology. E. g. in fully connected
     * *WebChannel* you are connected to each other peer in the group, however
     * in the star structure this attribute contains only the connection to
     * the central peer.
     * @private
     * @type {external:Set}
     */
    this.channels = new Set()

    /**
     * This event handler is used to resolve *Promise* in {@link WebChannel#join}.
     * @private
     */
     // TODO: add type to doc
    this.onJoin

    /**
     * Set of joining peers.
     * @private
     * @type {external:Set}
     */
    this.joiningPeers = new Set()

    /**
     * *WebChannel* topology.
     * @private
     * @type {string}
     */
    this.topology = this.settings.topology

    /**
     * Total peer number in the *WebChannel*.
     * @private
     * @type {number}
     */
    this.members = []

    /**
     * @private
     * @type {number}
     */
    this.pingTime = 0

    /**
     * The *WebChannel* gate.
     * @private
     * @type {WebChannelGate}
     */
    this.gate = new WebChannelGate((closeEvt) => this.onClose(closeEvt))

    /**
     * Unique identifier of this *WebChannel*. The same for all peers.
     * @readonly
     */
    this.id = this.generateId()

    /**
     * Unique peer identifier of you in this *WebChannel*. After each `join` function call
     * this id will change, because it is up to the *WebChannel* to assign it when
     * you join.
     * @readonly
     */
    this.myId = this.generateId()

    /**
     * Is the event handler called when a new peer has  joined the *WebChannel*.
     * @param {number} id - Id of the joined peer
     */
    this.onJoining = (id) => {}

    /**
     * Is the event handler called when a message is available on the *WebChannel*.
     * @param {number} id - Id of the peer who sent this message
     * @param {string|external:ArrayBufferView} data - Message
     * @param {boolean} isBroadcast - It is true if the message is sent via
     * [send]{@link WebChannel#send} method and false if it is sent via
     * [sendTo]{@link WebChannel#sendTo} method
     */
    this.onMessage = (id, msg, isBroadcast) => {}

    /**
     * Is the event handler called when a peer hes left the *WebChannel*.
     * @param {number} id - Id of the peer who has left
     */
    this.onLeaving = (id) => {}

    /**
     * Is the event handler called when the *WebChannel* has been closed.
     * @param {external:CloseEvent} id - Close event object
     */
    this.onClose = (closeEvt) => {}
  }

  /**
   * Enable other peers to join the *WebChannel* with your help as an
   * intermediary peer.
   * @param  {Object} [options] Any available connection service options
   * @returns {Promise} It is resolved once the *WebChannel* is open. The
   * callback function take a parameter of type {@link WebChannel~AccessData}.
   */
  open (options = {}) {
    let settings = Object.assign({}, this.settings, options)
    return this.gate.open((channel) => {
      this.initChannel(channel)
        .then((channel) => this.addChannel(channel))
    }, settings)
  }

  /**
    * Add a channel to the current peer network according to the topology
    *
    * @private
    * @param {Object} channel - Channel which needs to be add in the topology
    * @return {Promise} It resolves once the channel is add
    */
  addChannel (channel) {
    let jp = this.addJoiningPeer(channel.peerId, this.myId, channel)
    this.manager.broadcast(this, msgBld.msg(JOIN_NEW_MEMBER, {newId: channel.peerId}))
    channel.send(msgBld.msg(JOIN_INIT, {
      manager: this.settings.topology,
      wcId: this.id
    }, channel.peerId))
    return this.manager.add(channel)
      .then(() => channel.send(msgBld.msg(JOIN_FINILIZE)))
      .catch((msg) => {
        this.manager.broadcast(this, msgBld.msg(
          REMOVE_NEW_MEMBER, {id: channel.peerId})
        )
        this.removeJoiningPeer(jp.id)
      })
  }

  /**
    * Add a bot server to the network with his hostname and port
    *
    * @param {string} host - The hotname or the ip of the bot server to be add
    * @param {number} port - The port of the bot server to be add
    * @return {Promise} It resolves once the bot server joined the network
    */
  addBotServer (host, port) {
    return new Promise((resolve, reject) => {
      let cBuilder = provide(WEBSOCKET, {host, port, addBotServer: true})
      let url = 'ws://' + host + ':' + port
      cBuilder.connect(url).then((socket) => {
        /*
          Once the connection open a message is sent to the server in order
          that he can join initiate the channel
        */
        socket.send(JSON.stringify({code: ADD_BOT_SERVER, sender: this.myId, wcId: this.id}))
        this.initChannel(socket)
          .then((channel) => this.addChannel(channel))
          .then(() => resolve())
      }).catch((reason) => {
        reject(reason)
      })
    })
  }

  /**
    * Allow a bot server to join the network by creating a connection
    * with the peer who asked his coming
    *
    * @param {Object} channel - The channel between the server and the pair
    * who requested the add
    * @param {number} id - The id of the peer who requested the add
    * @return {Promise} It resolves once the the server has joined the network
    */
  joinAsBot (channel, id) {
    return new Promise((resolve, reject) => {
      this.onJoin = () => resolve(this)
      this.initChannel(channel, id)// .then((channel) => {
        // console.log('[DEBUG] Resolved initChannel by server')
      // })
    })
  }

  /**
   * Prevent clients to join the `WebChannel` even if they possesses a key.
   */
  close () {
    this.gate.close()
  }

  /**
   * If the *WebChannel* is open, the clients can join it through you, otherwise
   * it is not possible.
   * @returns {boolean} True if the *WebChannel* is open, false otherwise
   */
  isOpen () {
    return this.gate.isOpen()
  }

  /**
   * Get the data which should be provided to all clients who must join
   * the *WebChannel*. It is the same data which
   * {@link WebChannel#openForJoining} callback function provides.
   * @returns {WebChannel~AccessData|null} - Data to join the *WebChannel*
   * or null is the *WebChannel* is closed
   */
  getAccess () {
    return this.gate.accessData
  }

  /**
   * Join the *WebChannel*.
   * @param  {string} key - The key provided by one of the *WebChannel* members.
   * @param  {type} [options] - Any available connection service options.
   * @returns {Promise} It resolves once you became a *WebChannel* member.
   */
  join (key, options = {}) {
    let settings = Object.assign({}, this.settings, options)
    let webSocketService = provide(WEBSOCKET)
    let wsWithSignaling
    let webRTCService = provide(this.settings.connector)
    return new Promise((resolve, reject) => {
      this.onJoin = () => resolve(this)
      webSocketService.connect(settings.signaling)
        .then((ws) => {
          wsWithSignaling = ws
          return webRTCService.connectOverSignaling(ws, key)
        })
        .then((channel) => {
          wsWithSignaling.onclose = null
          wsWithSignaling.close()
          return this.initChannel(channel)
        })
        .catch(reject)
    })
  }

  /**
   * Leave the *WebChannel*. No longer can receive and send messages to the group.
   */
  leave () {
    // FIXME: refactore this
    if (this.channels.size !== 0) {
      this.topology = this.settings.topology
      this.channels.forEach((c) => {
        c.channel.onmessage = () => {}
        c.channel.onclose = () => {}
        c.channel.onerror = () => {}
      })
      this.manager.broadcast(this, msgBld.msg(LEAVE))
      this.channels.clear()
      // this.joiningPeers.clear()
      this.gate.close()
    }
  }

  /**
   * Send the message to all *WebChannel* members.
   * @param  {string|external:ArrayBufferView} data - Message
   */
  send (data) {
    if (this.channels.size !== 0) {
      msgBld.handleUserMessage(data, null, (dataChunk) => {
        this.manager.broadcast(this, dataChunk)
      })
    }
  }

  /**
   * Send the message to a particular peer in the *WebChannel*.
   * @param  {number} id - Id of the recipient peer
   * @param  {string|external:ArrayBufferView} data - Message
   */
  sendTo (id, data) {
    if (this.channels.size !== 0) {
      msgBld.handleUserMessage(data, id, (dataChunk) => {
        this.manager.sendTo(id, this, dataChunk)
      }, false)
    }
  }

  /**
   * Get the ping of the *WebChannel*. It is an amount in milliseconds which
   * corresponds to the longest ping to each *WebChannel* member.
   * @returns {Promise}
   */
  ping () {
    if (this.channels.size !== 0) {
      return new Promise((resolve, reject) => {
        if (this.pingTime === 0) {
          this.pingTime = Date.now()
          this.maxTime = 0
          this.pongNb = 0
          this.pingFinish = (delay) => { resolve(delay) }
          this.manager.broadcast(this, msgBld.msg(PING))
          setTimeout(() => { resolve(PING_TIMEOUT) }, PING_TIMEOUT)
        }
      })
    } else {
      return Promise.resolve(0)
    }
  }

  get topology () {
    return this.settings.topology
  }

  /**
   * Send a message to a service of the same peer, joining peer or any peer in
   * the *WebChannel*.
   * @private
   * @param  {string} serviceName - Service name.
   * @param  {string} recepient - Identifier of recepient peer id.
   * @param  {Object} [msg={}] - Message to send.
   */
  sendSrvMsg (serviceName, recepient, msg = {}, channel = null) {
    // console.log('[DEBUG] sendSrvMsg (serviceName, recepient, msg = {}, channel = null) (',
    // serviceName, ', ', recepient, ', ', msg, ', ', channel, ')')
    let fullMsg = msgBld.msg(
      SERVICE_DATA, {serviceName, data: Object.assign({}, msg)},
      recepient
    )
    if (channel !== null) {
      channel.send(fullMsg)
      return
    }
    if (recepient === this.myId) {
      this.onChannelMessage(null, fullMsg)
    } else {
      // If this function caller is a peer who is joining
      if (this.isJoining()) {
        this.getJoiningPeer(this.myId)
          .intermediaryChannel
          .send(fullMsg)
      } else {
        // If the recepient is a joining peer
        if (this.hasJoiningPeer(recepient)) {
          let jp = this.getJoiningPeer(recepient)
          // If I am an intermediary peer for recepient
          if (jp.intermediaryId === this.myId) {
            jp.intermediaryChannel.send(fullMsg)
          // If not, then send this message to the recepient's intermediary peer
          } else {
            this.manager.sendTo(jp.intermediaryId, this, fullMsg)
          }
        // If the recepient is a member of webChannel
        } else {
          this.manager.sendTo(recepient, this, fullMsg)
        }
      }
    }
  }

  /**
   * Message event handler (*WebChannel* mediator). All messages arrive here first.
   * @private
   * @param {Channel} channel - The channel the message came from
   * @param {external:ArrayBuffer} data - Message
   */
  onChannelMessage (channel, data) {
    let header = msgBld.readHeader(data)
    // console.log('ON CHANNEL MESSAGE:\n - code=' + header.code + '\n - sender=' + header.senderId + '\n - recepient=' + header.recepientId)
    // console.log('[DEBUG] {onChannelMessage} header: ', header)
    if (header.code === USER_DATA) {
      msgBld.readUserMessage(this, header.senderId, data, (fullData, isBroadcast) => {
        this.onMessage(header.senderId, fullData, isBroadcast)
      })
    } else {
      let msg = msgBld.readInternalMessage(data)
      switch (header.code) {
        case LEAVE:
          for (let c of this.channels) {
            if (c.peerId === header.senderId) {
              c.close()
              this.channels.delete(c)
            }
          }
          this.members.splice(this.members.indexOf(msg.id), 1)
          // this.onLeaving(msg.id)
          break
        case SERVICE_DATA:
          if (this.myId === header.recepientId) {
            provide(msg.serviceName, this.settings).onMessage(this, channel, msg.data)
          } else {
            this.sendSrvMsg(msg.serviceName, header.recepientId, msg.data)
          }
          break
        case JOIN_INIT:
          this.topology = msg.manager
          this.myId = header.recepientId
          this.id = msg.wcId
          channel.peerId = header.senderId
          this.addJoiningPeer(this.myId, header.senderId, channel)
          break
        case JOIN_NEW_MEMBER:
          this.addJoiningPeer(msg.newId, header.senderId)
          break
        case REMOVE_NEW_MEMBER:
          this.removeJoiningPeer(msg.id)
          break
        case JOIN_FINILIZE:
          this.joinSuccess(this.myId)
          this.manager.broadcast(this, msgBld.msg(JOIN_SUCCESS))
          this.onJoin()
          break
        case JOIN_SUCCESS:
          this.joinSuccess(header.senderId)
          this.members.push(header.senderId)
          this.onJoining(header.senderId)
          this.manager.sendTo(header.senderId, this, msgBld.msg(MEMBERS, {
            members: this.members
          }))
          break
        case MEMBERS:
          this.members = msg.members
          break
        case INIT_OK:
          channel.onOk()
          delete channel.onOk
          break
        case PING:
          this.manager.sendTo(header.senderId, this, msgBld.msg(PONG))
          break
        case PONG:
          let now = Date.now()
          this.pongNb++
          this.maxTime = Math.max(this.maxTime, now - this.pingTime)
          if (this.pongNb === this.members.length) {
            this.pingFinish(this.maxTime)
            this.pingTime = 0
          }
          break
        default:
          throw new Error(`Unknown message type code: "${header.code}"`)
      }
    }
  }

  /**
   * Error event handler for each *Channel* in the *WebChannel*.
   * @private
   * @param {external:Event} evt - Event
   */
  onChannelError (evt) {
    console.error(`RTCDataChannel: ${evt.message}`)
  }

  /**
   * Close event handler for each *Channel* in the *WebChannel*.
   * @private
   * @param {external:CloseEvent} closeEvt - Close event
   */
  onChannelClose (closeEvt, peerId) {
    // FIXME: refactore this
    for (let c of this.channels) {
      if (c.peerId === peerId) this.channels.delete(c)
    }
    this.members.splice(this.members.indexOf(peerId), 1)
    this.onLeaving(peerId)
    // console.info(`Channel with ${peerId} has been closed: ${closeEvt.type}`)
  }

  set topology (name) {
    this.settings.topology = name
    this.manager = provide(this.settings.topology)
  }

  /**
   * Initialize channel. The *Channel* object is a facade for *WebSocket* and
   * *RTCDataChannel*.
   * @private
   * @param {external:WebSocket|external:RTCDataChannel} ch - Channel to
   * initialize
   * @param {number} [id] - Assign an id to this channel. It would be generated
   * if not provided
   * @returns {Promise} - Resolved once the channel is initialized on both sides
   */
  initChannel (ch, id = -1) {
    return new Promise((resolve, reject) => {
      if (id === -1) { id = this.generateId() }
      let channel = new Channel(ch, this, id)
      // TODO: treat the case when the 'ping' or 'pong' message has not been received
      channel.config()
      channel.onOk = () => resolve(channel)
      ch.send('ok')
      ch.onmessage = (msgEvt) => {
        if (msgEvt.data === 'ok') {
          channel.config()
          channel.send(msgBld.msg(INIT_OK))
          resolve(channel)
        }
      }
    })
  }

  /**
   * Function to be executed on each peer once the joining peer has joined the
   * *WebChannel*
   * @private
   * @param  {number} id Identifier of the recently joined peer
   */
  joinSuccess (id) {
    let jp = this.getJoiningPeer(id)
    jp.channelsToAdd.forEach((c) => {
      this.channels.add(c)
    })
    // TODO: handle channels which should be closed & removed
    this.joiningPeers.delete(jp)
  }

  /**
   * Get joining peer by his id.
   * @private
   * @throws Will throws an error if the peer could not be found
   * @param  {number} id Peer id
   */
  getJoiningPeer (id) {
    // if (this.myId !== id) {
    //   console.log('Me ' + this.myId + ' is looking for ' + id)
    // }
    for (let jp of this.joiningPeers) {
      if (jp.id === id) {
        return jp
      }
    }
    throw new Error('Peer ' + this.myId + ' could not find the joining peer ' + id)
  }

  /**
   * Get all joining peers.
   * @private
   * @returns {external:Set} - Joining peers
   */
  getJoiningPeers () {
    return this.joiningPeers
  }

  /**
   * Add joining peer.
   * @private
   * @param  {number} jpId - Joining peer id
   * @param  {number} intermediaryId - The id of the peer through whom the
   * joining peer joins the *WebChannel*
   * @param  {Channel} [intermediaryChannel] - Intermediary channel bitween the
   * joining peer and his intermediary peer
   * @returns {JoiningPeer} - Just added joining peer
   */
  addJoiningPeer (jpId, intermediaryId, intermediaryChannel = null) {
    // if (this.myId !== jpId) {
    //   console.log('Me ' + this.myId + ' is adding: ' + jpId + ' where intermediaryId is ' + intermediaryId + ' and the channel is ' + (intermediaryChannel !== null))
    // }
    let jp = new JoiningPeer(jpId, intermediaryId, intermediaryChannel)
    if (this.hasJoiningPeer(jpId)) {
      throw new Error('Joining peer already exists!')
    }
    this.joiningPeers.add(jp)
    return jp
  }

  /**
   * Remove joining peer from the joining peer list if he exists. It is done when the joining
   * peer finished the joining process succesfully or not.
   * @private
   * @param  {number} jpId - Joining peer id
   */
  removeJoiningPeer (jpId) {
    if (this.hasJoiningPeer(jpId)) {
      this.joiningPeers.delete(this.getJoiningPeer(jpId))
    }
  }

  /**
   * Check whether this peer is about to join the *WebChannel*.
   * @private
   * @returns {boolean} - True if this peer is joining the *WebChannel* and false
   * otherwise
   */
  isJoining () {
    for (let jp of this.joiningPeers) {
      if (jp.id === this.myId) {
        return true
      }
    }
    return false
  }

  /**
   * Verify if this peer knows about specific joining peer.
   * @private
   * @param  {number} jpId - Joining peer id
   * @returns {boolean} - True if the peer is present, false if not.
   */
  hasJoiningPeer (jpId) {
    for (let jp of this.joiningPeers) {
      if (jp.id === jpId) {
        return true
      }
    }
    return false
  }
  /**
   * Generate random id for a *WebChannel* or a new peer.
   * @private
   * @returns {number} - Generated id
   */
  generateId () {
    let id
    do {
      id = Math.ceil(Math.random() * MAX_ID)
      for (let c of this.channels) {
        if (id === c.peerId) continue
      }
      if (this.hasJoiningPeer(id)) continue
      if (id === this.myId) continue
      break
    } while (true)
    return id
  }
}

const ADD_BOT_SERVER$1 = 'addBotServer'
const NEW_CHANNEL$1 = 'newChannel'

class Bot {
  constructor (options = {}) {
    if (isBrowser()) throw new Error('Bot can be instanciated only in Node\'s environment')
    this.defaults = {
      host: '127.0.0.1',
      port: 9000,
      log: false
    }
    this.settings = Object.assign({}, this.defaults, options)

    this.server
    this.webChannels = []

    this.onWebChannel = (wc) => {
      // this.log('connected', 'Connected to the network')
      // this.log('id', wc.myId)
    }

    this.onLaunch = () => {
      // this.log('WebSocketServer', 'Server runs on: ws://' + this.settings.host + ':' + this.settings.port)
    }

    this.onConnection = () => {
      // this.log('connected', 'Connection of one client')
    }

    this.onAddRequest = () => {
      // this.log('add', 'Add request received')
    }

    this.onNewChannelRequest = () => {
      // this.log('new_channel', 'New channel request received')
    }

    this.onCodeError = () => {
      // this.log('error', 'Unknown code message')
    }
  }

  listen (options = {}) {
    return new Promise((resolve, reject) => {
      this.settings = Object.assign({}, this.settings, options)
      let WebSocketServer = require('ws').Server
      this.server = new WebSocketServer({host: this.settings.host, port: this.settings.port}, () => {
        this.onLaunch()
        resolve()
      })

      this.server.on('error', () => {
        reject('WebSocketServerError with ws://' + this.settings.host + ':' + this.settings.port)
      })

      this.server.on('connection', (socket) => {
        this.onConnection()

        socket.on('message', (msg) => {
          var data = {code: ''}
          try {
            data = JSON.parse(msg)
          } catch (e) {}
          switch (data.code) {
            case ADD_BOT_SERVER$1:
              this.addBotServer(socket, data)
              break
            case NEW_CHANNEL$1:
              this.newChannel(socket, data)
              break
            default:
              this.onCodeError()
          }
        })
      })
    })
  }

  addBotServer (socket, data) {
    let alreadyPresent = false
    this.webChannels.forEach((wc, index) => {
      if (data.wcId === wc.id) alreadyPresent = true
    })

    if (!alreadyPresent) {
      this.onAddRequest()
      let webChannel

      webChannel = new WebChannel({'connector': 'WebSocket',
        host: this.settings.host, port: this.settings.port})

      webChannel.joinAsBot(socket, data.sender).then(() => {
        this.onWebChannel(webChannel)
      })

      this.webChannels.push(webChannel)
    }
  }

  newChannel (socket, data) {
    let channelBuilderService = provide(CHANNEL_BUILDER)
    this.onNewChannelRequest()
    for (var wc of this.webChannels) {
      if (data.wcId === wc.id) {
        channelBuilderService.onChannel(wc, socket, data.oneMsg, data.sender)
        break
      }
    }
  }

  leave (WebChannel) {
    let index = -1
    for (let i = 0; i < this.webChannels.length; i++) {
      if (WebChannel.id === this.webChannels[i].id) {
        index = i
        break
      }
    }
    this.webChannels.splice(index, 1)[0].leave()
  }

  getWebChannels () {
    return this.webChannels
  }

  getServer () {
    return this.server
  }

  log (label, msg) {
    if (this.settings.log) {
      var d = new Date()
      let datetime = '' + d.toLocaleTimeString() + ' ' + d.toLocaleDateString()
      console.log('[', label.toUpperCase(), '] [', datetime, ']', msg)
    }
  }
}

exports.WebChannel = WebChannel;
exports.Bot = Bot;

Object.defineProperty(exports, '__esModule', { value: true });

})));