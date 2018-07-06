var RPC = require('rpc-stream');
var multiplex = require('multiplex');
// var has = require('has');

module.exports = function (api) {
    var index = 2;
    var streams = {};
    var irpc = RPC({ // internal rpc
        open: function (id, name, args) {
            if (typeof api[name] !== 'function') return;
            var stream = api[name].apply(null, args);
            if (!stream || typeof stream.pipe !== 'function') return;
            stream.pipe(mx.createSharedStream(id)).pipe(stream);
        }
    });
    var iclient = irpc.wrap([ 'open' ]);
    var prpc = RPC(api, {
      flattenError: (err) => {
        if (!(err instanceof Error)) return err
        console.error('sending error over rpc', err)
        return {
          message: err.message,
          stack: err.stack,
        }
      },
    }); // public interface

    var mx = multiplex({ chunked: true });
    irpc.pipe(mx.createSharedStream('0')).pipe(irpc);
    prpc.pipe(mx.createSharedStream('1')).pipe(prpc);

    mx.wrap = function (methods) {
        var names = methods.map(function (m) {
            return m.split(':')[0];
        });
        var wrapped = prpc.wrap(names);
        methods.forEach(function (m) {
            var parts = m.split(':');
            var name = parts[0];
            if (parts[1] === 's') {
                wrapped[name] = wrapStream(name);
            }
        });
        return wrapped;
    };
    return mx;

    function wrapStream (name) {
        return function () {
            var args = [].slice.call(arguments);
            var id = String(index++);
            iclient.open(id, name, args);
            return mx.createSharedStream(id);
        };
    }
};
