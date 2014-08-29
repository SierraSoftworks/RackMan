module.exports = Limit;

function Limit(rate, callback) {
	this.rate = rate;
	this.callback = callback;
};

Limit.prototype.poke = function() {
	var self = this;
	var args = arguments;
	this.cancel();

	this.handle = setTimeout((function() {
		this.handle = null;
		this.callback.apply(self, args);
	}).bind(this), this.rate);
};

Limit.prototype.cancel = function() {
	if(this.handle) clearTimeout(this.handle);
	this.handle = null;
};