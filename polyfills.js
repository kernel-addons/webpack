if (typeof Array.prototype.at !== "function") {
    Object.defineProperty(Array.prototype, "at", {
        value: function (index) {
            return index < 0 ? this[this.length - Math.abs(index)] : this[index];
        },
        configurable: true,
        writable: true,
        enumerable: false
    });
}

if (typeof setImmediate === "undefined") {
    window.setImmediate = (callback) => requestAnimationFrame(callback);
}