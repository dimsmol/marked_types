"use strict";
var getTypeMarker = function (type) {
	var result = null;
	while (type != null) {
		if (type.typeMarker_ != null) {
			result = type.typeMarker_;
		}
		type = type.super_;
	}
	return result;
};

var mark = function (type, id) {
	var existing = getTypeMarker(type);

	var marker = id;
	if (existing) {
		marker += [existing, id].join(' ');
	}

	type.typeMarker_ = marker;
	type.prototype.typeMarker_ = marker;
};

var is = function (obj, type) {
	var result = false;
	if (obj != null && obj.typeMarker_) {
		var marker = getTypeMarker(type);
		if (marker) {
			if (marker.length == obj.typeMarker_.length) {
				result = (obj.typeMarker_ == marker);
			}
			else {
				result = (
					obj.typeMarker_.indexOf(marker) === 0 &&
					obj.typeMarker_[marker.length] == ' ' &&
					obj.typeMarker_[marker.length - 1] != '\\'
				);
			}
		}
	}
	return result;
};

module.exports = {
	mark: mark,
	is: is
};
