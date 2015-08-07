/**
 * MEDIUM:
 * gpg
 * mobile
 * hd
 * password recovery service
 * allow funds to be viewable
 * fireworks for tips
 * password requirements, especially with bip38
 * modifying textarea causes page to advance, only initial paste
 * play with URLs, e.g. add URL to file then one click claim
 * FAQ and/or video
 * link to where you can spend bitcoins on success screens
 * 
 * LOW:
 * super streamlined claim option?
 * make a giant green claim button to reinforce the idea that sender has access?
 * offline mode isn't reliably detected
 * keyboard navigation through most of it?
 * rather than positive amt, positive amt above and beyond dust
 * use bitcoin qr code generator instead
 * reconcile imported vs unlocked terminology
 * when adding funds to unlocked, display add amount plus new balance
 * prevent text overlay when flipping quickly?
 * import, unlock, then go back and wrong password, should probably clear. or don't allow password again
 * clearly state browser requirements
 * allow qr codes to be opened with wallet
 * if invalid mp upload, clear upload form
 * refactor to be truly object-oriented?
 * inconsistent naming convention from _error to _msg
 * realtime amount validations do not report negative amounts
 * automatically import mp after new mp created and funded
 * set expiration date to claim funds before they're returned
 * compute minimum send amount and pre-validate in forms instead of try catch
 * Give credit to BitPay for BitCore and recommend CoPay as the best wallet I have used to date
 * Step by step both the features and the process.
 * Sender may continue to add funds to a money packet at any time. (HD coming eventually, if possible)
 * mouse movements to generate private key
 */

// dependencies
var sjcl = require('sjcl');
var Bip38 = require('bip38');
var bitcore = null;	// loaded asynchronously
var insight = null; // loaded asynchronously

// instance variables
var page_manager;
var imported_mp;
var imported_private_key;
var imported_public_address;
var imported_listener;
var imported_network_info;
var unlocked_mp_balance;
var claim_mp;
var claim_mp_public_address;
var new_mp;
var new_mp_private_key;
var new_mp_public_address;
var new_mp_listener;
var new_mp_network_info;
var new_mp_balance;
var new_mp_add_done_tip;
var exchange_rates = null;
var online = true;
var bip38;
var tip_selection;

// constants
var NETWORK_REFRESH_RATE = 1000;
var EXCHANGE_RATE_REFRESH_RATE = 60000;
var TIP_ADDRESS = "1B2Bq6YXkguYWwBG68iDGFXzDcN89USryo";
var EDGE_WIDTH = 150;
var PREFERRED_UNIT_DEFAULT = "USD";
var DEFAULT_ITER = 10000;
var DEFAULT_TIP = 1;
var DEFAULT_TIP_UNIT = "USD";

// IE workaround
var isIE = /*@cc_on!@*/false || !!document.documentMode;

/**
 * Document initialization.
 */
$(document).ready(function() {
	// load bitcore asynchronously
	jQuery.getScript("lib/bitcore.js", function(script, status) {
		jQuery.getScript("lib/bitcore-explorers.js", function(script, status) {
			bitcore = require('bitcore');
			insight = require('bitcore-explorers').Insight();
		});
	});
	
	// general setup
	$(".page").hide();
	$("#background_page").show();
	$("#home_page").show();
	page_manager = new PageManager("home_page");
	$("#left_arrow").addClass("hidden").click(function() { page_manager.prev(); });
	$("#right_arrow").addClass("hidden").click(function() { page_manager.next(); });
	//$("#center_div").width($(window).width() - EDGE_WIDTH);
	//$(window).resize(function() { $("#center_div").width($(window).width() - EDGE_WIDTH); });
	//$("#preferred_unit_div").width($(window).width() - EDGE_WIDTH);
	//$(window).resize(function() { $("#preferred_unit_div").width($(window).width() - EDGE_WIDTH); });
	$.ajaxSetup({ cache: false });
	new exchange_rate_listener(EXCHANGE_RATE_REFRESH_RATE);
	$("#preferred_unit_select").change(on_unit);
	$("#offline_div").hide();
	bip38 = new Bip38();
	
	// home page
	$("#home_import_link").click(function() { page_manager.next("import_upload_page"); });
	$("#home_create_link").click(function() { page_manager.next("new_mp_password_page"); });
	
	// import process
	$("#import_paste_link").click(function() { page_manager.next("import_paste_page"); });
	$("#import_paste_textarea").on('input', on_import_paste_textarea);
	$("#import_password").keyup(function(event) { if (event.keyCode == 13) { on_unlock(); } });
	$("#unlock_button").click(on_unlock);
	$("#unlocked_claim_mp_link").click(function() { page_manager.next("claim_mp_password_page"); });
	$("#unlocked_claim_address_link").click(function() { page_manager.next("claim_address_page"); });
	$("#unlocked_add_link").click(function() { page_manager.next("unlocked_mp_add_page"); });
	
	// send to new money packet
	$("#claim_mp_set_password_button").click(on_claim_mp_set_password);
	$("#claim_mp_password1").keyup(function(event) { if (event.keyCode == 13) { $("#claim_mp_password1").blur(); on_claim_mp_set_password(); } });
	$("#claim_mp_password2").keyup(function(event) { if (event.keyCode == 13) { $("#claim_mp_password2").blur(); on_claim_mp_set_password(); } });
	$("#claim_mp_advanced_link").click(on_claim_mp_advanced_link);
	$("#claim_mp_download_button").click(on_claim_mp_download);
	$("#claim_mp_download_copy_link").click(function() { page_manager.next("claim_mp_copy_page"); });
	$("#claim_mp_download_confirm_button").click(on_claim_mp_download_confirm_button);
	$("#claim_mp_copy_confirm_button").click(on_claim_mp_copy_confirm_button);
	$("#claim_mp_send_full_balance").click(on_claim_mp_send_full_balance);
	$("#claim_mp_send_button").click(on_claim_mp_send);
	$("#claim_mp_send_amt").on("input", function() { on_claim_mp_send_amt(); });
	$("#claim_mp_done_another_link").click(function() { page_manager.move("unlocked_page"); });
	$("#claim_mp_done_home_link").click(function() { page_manager.move("home_page"); });
	
	// imported send to bitcoin address
	$("#claim_address").on("input", function() { on_claim_address(); });
	$("#claim_address_amt").on("input", function() { on_claim_address_amt(); });
	$("#claim_address_full_balance").click(on_claim_address_full_balance);
	$("#claim_address_send_button").click(on_claim_address_send);
	$("#claim_address_done_another_link").click(function() { page_manager.move("unlocked_page"); });
	$("#claim_address_done_home_link").click(function() { page_manager.move("home_page"); });
	
	// imported add funds
	$("#unlocked_mp_add_amt").on("input", function() { on_unlocked_mp_add_amt(); });
	$("#unlocked_mp_add_another_link").click(function() { page_manager.move("unlocked_page"); });
	$("#unlocked_mp_add_home_link").click(function() { page_manager.move("home_page"); });
	
	// new money packet
	$("#new_mp_set_password_button").click(on_new_mp_set_password);
	$("#new_mp_password1").keyup(function(event) { if (event.keyCode == 13) { $("#new_mp_password1").blur(); on_new_mp_set_password(); } });
	$("#new_mp_password2").keyup(function(event) { if (event.keyCode == 13) { $("#new_mp_password2").blur(); on_new_mp_set_password(); } });
	$("#new_mp_advanced_link").click(on_new_mp_advanced_link);
	$("#new_mp_download_button").click(on_new_mp_download);
	$("#new_mp_download_copy_link").click(function() { page_manager.next("new_mp_copy_page"); });
	$("#new_mp_download_confirm_button").click(on_new_mp_download_confirm_button);
	$("#new_mp_copy_confirm_button").click(on_new_mp_copy_confirm_button);
	$("#new_mp_add_amt").on("input", function() { on_new_mp_add_amt(); });
	$("#new_mp_add_home_link").click(function() { page_manager.move("home_page"); });
});

/**
 * Tracks navigation and handles page changes.
 */
function PageManager(start_id) {
	
	var pages = [start_id];
	var idx = 0;
	var that = this;
	update_arrows();
	
	this.current = function() {
		return pages[idx];
	};
	
	this.has = function(id) {
		return pages.indexOf(id) != -1;
	}
	
	this.next = function(id) {
		if (id == null) {
			$('#' + pages[idx++]).toggle("slide", {direction: "left"}, 400);
			$('#' + pages[idx]).toggle("slide", {direction: "right", complete:function() { show_page(pages[idx]); }}, 400);
			update_arrows();
		} else {
			that.clear_nexts();
			init_page(id);
			pages.push(id);
			that.next();
		}
	};
	
	this.prev = function(id) {
		if (id == null) {
			$('#' + pages[idx--]).toggle("slide", {direction: "right"}, 400);
			$('#' + pages[idx]).toggle("slide", {direction: "left", complete:function() { show_page(pages[idx]); }}, 400);
			update_arrows();
		} else {
			that.clear_prevs();
			init_page(id);
			pages.unshift(id);
			idx++;
			that.prev();
		}
	};
	
	this.move = function(id) {
		var targetIdx = pages.indexOf(id);
		if (targetIdx == -1) console.err("Page does not exist: " + id);
		else {
			if (targetIdx < idx) {
				$('#' + pages[idx]).toggle("slide", {direction: "right"}, 400);
				$('#' + pages[targetIdx]).toggle("slide", {direction: "left", complete:function() { show_page(pages[idx]); }}, 400);
			} else if (targetIdx > idx) {
				$('#' + pages[idx]).toggle("slide", {direction: "left"}, 400);
				$('#' + pages[targetIdx]).toggle("slide", {direction: "right", complete:function() { show_page(pages[idx]); }}, 400);
			}
			idx = targetIdx;
			update_arrows();
		}
	}
	
	this.clear_nexts = function() {
		pages.slice(idx + 1).forEach(function(id) {
			clear_page(id);
		});
		pages = pages.slice(0, idx + 1);
		update_arrows();
	}
	
	this.clear_prevs = function() {
		pages.slice(0, idx).forEach(function(id) {
			clear_page(id);
		});
		pages = pages.slice(idx);
		idx = 0;
		update_arrows();
	}
	
	this.remove = function(id) {
		var i = pages.indexOf(id);
		if (i <= idx) idx--;
		clear_page(pages[i]);
		pages.splice(i, 1);
	}
	
	function update_arrows() {
		idx > 0 ? $("#left_arrow").removeClass("hidden") : $("#left_arrow").addClass("hidden");
		idx < pages.length - 1 ? $("#right_arrow").removeClass("hidden") : $("#right_arrow").addClass("hidden");
	}
	
	/**
	 * Initializes the pages.
	 */
	function init_page(id) {
		switch (id) {
		case "import_upload_page":
			$("#import_upload").replaceWith($("#import_upload").val('').clone(true));
			$("#import_upload_error").text("");
			break;
		case "import_paste_page":
			$("#import_paste_textarea").val("");
			$("#import_paste_error").text("");
			break;
		case "unlock_page":
			$("#import_password").val("");
			$("#import_password_msg").text("");
			break;
		case "unlocked_page":
			$("#unlocked_balance").text("...");
			imported_listener = new network_listener(imported_public_address, NETWORK_REFRESH_RATE, on_imported_balance);
			imported_network_info = {};
			break;
		case "unlocked_mp_add_page":
			$("#unlocked_mp_qrcode").empty();
			$("#unlocked_mp_qrcode_address").text("");
			$("#unlocked_mp_add_amt").val("");
			$("#unlocked_mp_add_amt_error").text("");
			update_unlocked_mp_unit_labels();
			$("#unlocked_mp_add_btc_conversion").html("&nbsp;");
			
			// draw qr code
			$("#unlocked_mp_qrcode").empty();
			$("#unlocked_mp_qrcode").attr("href", "bitcoin:" + imported_public_address);
			new QRCode("unlocked_mp_qrcode", {
				text:"bitcoin:" + imported_public_address,
				width:125,
				height:125
			});
			$("#unlocked_mp_qrcode_address").text(imported_public_address);
			break;
		case "unlocked_mp_add_done_page":
			$("#unlocked_mp_add_done_amt").text("");
			break;
		case "claim_mp_password_page":
			$("#claim_mp_password1").val("");
			$("#claim_mp_password2").val("");
			$("#claim_mp_password_msg").text("");
			$("#claim_mp_advanced_link").text("\u25b8 Advanced");
			$("#claim_mp_advanced_div").hide();
			$("#claim_mp_bip38_checkbox").prop("checked", false);
			break;
		case "claim_mp_download_page":
			$("#claim_mp_download_confirm_button").hide();
			break;
		case "claim_mp_copy_page":
			$("#claim_mp_copy_textarea").val(get_mp_text(claim_mp));
			break;
		case "claim_mp_send_page":
			$("#claim_mp_send_amt").val("");
			$("#claim_mp_send_msg").text("");
			$("#claim_mp_send_amt_error").text("");
			update_claim_mp_send_unit_labels();
			update_claim_mp_send_button();
			break;
		case "claim_address_page":
			$("#claim_address").val("");
			$("#claim_address_msg").text("");
			$("#claim_address_amt").val("");
			$("#claim_address_amt_msg").text("");
			$("#claim_address_send_msg").text("");
			clear_canvas("claim_address_checkmark");
			$("#claim_address_full_balance").attr("disabled", "disabled");
			update_claim_address_unit_labels();
			update_claim_address_send_button();
			break;
		case "new_mp_password_page":
			$("#new_mp_password1").val("");
			$("#new_mp_password2").val("");
			$("#new_mp_password_msg").css("color","black").text("");
			$("#new_mp_advanced_link").text("\u25b8 Advanced");
			$("#new_mp_advanced_div").hide();
			$("#new_mp_bip38_checkbox").prop("checked", false);
			break;
		case "new_mp_download_page":
			new_mp_listener = new network_listener(new_mp_public_address, NETWORK_REFRESH_RATE, on_new_mp_balance);
			new_mp_network_info = {};
			new_mp_balance = 0;
			$("#new_mp_download_confirm_button").hide();
			break;
		case "new_mp_copy_page":
			$("#new_mp_copy_textarea").val(get_mp_text(new_mp));
			break;
		case "new_mp_add_page":
			$("#new_mp_qrcode").empty();
			$("#new_mp_qrcode_address").text("");
			$("#new_mp_add_amt").val("");
			$("#new_mp_add_amt_error").text("");
			update_claim_address_unit_labels();
			$("#new_mp_add_btc_conversion").html("&nbsp;");
			
			// reset tip selection
			$(".tip_link").removeClass("active");
			$("#tip0").addClass("active");
			tip_selection = "tip0";
			
			// draw qr code
			$("#new_mp_qrcode").empty();
			$("#new_mp_qrcode").attr("href", "bitcoin:" + new_mp_public_address);
			new QRCode("new_mp_qrcode", {
				text:"bitcoin:" + new_mp_public_address,
				width:125,
				height:125
			});
			$("#new_mp_qrcode_address").text(new_mp_public_address);
		case "new_mp_add_done_page":
			if (new_mp_add_done_tip) {
				$("#new_mp_add_done_msg").text("Thank you for the tip!!!");
			} else {
				$("#new_mp_add_done_msg").text("Funds added successfully!");
			}
			break;
		default:
			break;
		}
	}

	/**
	 * Clears page resources.
	 */
	function clear_page(id) {
		switch (id) {
		case "unlocked_page":
			if (imported_listener) imported_listener.stop_listening();
			break;
		case "claim_mp_password_page":
			claim_mp = null;
			claim_mp_public_address = null;
			break;
		case "new_mp_password_page":
			new_mp = null;
			new_mp_public_address = null;
			break;
		case "new_mp_download_page":
			if (new_mp_listener) new_mp_listener.stop_listening();
			break;
		default:
			break;
		}
	}

	/**
	 * Shows the pages.
	 */
	function show_page(id) {
		switch (id) {
		case "import_paste_page":
			$("#import_paste_textarea").focus();
			break;
		case "unlock_page":
			$("#import_password").focus();
			break;
		case "claim_mp_password_page":
			$("#claim_mp_password1").focus();
			break;
		case "claim_address_page":
			$("#claim_address").focus();
			break;
		case "unlocked_mp_add_page":
			$("#unlocked_mp_add_amt").focus();
			break;
		case "new_mp_password_page":
			$("#new_mp_password1").focus();
			break;
		case "claim_mp_send_page":
			$("#claim_mp_send_amt").focus();
		case "new_mp_add_page":
			$("#new_mp_add_amt").focus();
			break;
		default:
			break;
		}
	}
}

function on_import_upload(files) {
	var file = files[0];
	var reader = new FileReader();
	reader.onload = function(event) {
		imported_mp = get_mp(reader.result);
		if (imported_mp == null) {
			$("#import_upload_error").text("Invalid money packet.  Make sure you selected the right file.");
		} else {
			$("#import_upload_error").text("");
			page_manager.next("unlock_page");
		}
	};
	reader.readAsText(file);
}

function on_import_paste_textarea() {
	imported_mp = get_mp($("#import_paste_textarea").val());
	if ($("#import_paste_textarea").val() == "") {
		$("#import_paste_error").text("");
	} else if (imported_mp == null) {
		$("#import_paste_error").text("Invalid money packet text.  Copy and paste the entire file contents of your money packet.");
		page_manager.clear_nexts();
	} else {
		$("#import_paste_error").text("");
		page_manager.next("unlock_page");
	}
}


// ----------------------------- INGESTION FUNCTIONS --------------------------

/**
 * Ingests the given text to extract a money packet.
 * 
 * @param text is the text to ingest
 * @return object with private key and encryption scheme
 */
function get_mp(text) {
	if (text.length == 0) return null;
	var i = -1;
	while (i < text.length) {
		i++;
		var open_count = 0;
		if (text.charAt(i) != "{") continue;
		open_count++;
		
		// find close counterpart
		var j = i;
		while (j < text.length) {
			j++;
			if (text.charAt(j) == "{") open_count++;
			if (text.charAt(j) == "}") open_count--;
			if (open_count == 0) {
				var mp = parse_mp(text.substring(i, j + 1));
				if (mp != null) return mp;
				break;
			}
		}
	}
}

function parse_mp(text) {
	try {
		var mp = JSON.parse(text);
		if (valid_v021(mp)) mp = v021_to_v022(mp);	
		if (!valid_v022(mp)) mp = null;
		return mp;
	} catch (err) {
		return null;
	}
}

function valid_v021(mp) {
	return mp.iter != null && mp.iv != null && mp.ct != null;
}

function valid_v022(mp) {
	return mp.privateKey != null && (mp.encryption == "sjcl" || mp.encryption == "bip38");
}

function v021_to_v022(mp) {
	var converted = {};
	converted["privateKey"] = JSON.stringify(mp);
	converted["encryption"] = "sjcl";
	return converted;
}

// ------------------------------- IMPORT FUNCTIONS ---------------------------

function on_unlock() {
	// TODO: make this completely transparent
	if (bitcore == null || insight == null) {
		alert("Sorry, some dependencies are not loaded.  Please wait a moment and try again.");
		return;
	}
	
	// prevent 'enter' from being registered twice
	$("#import_password").blur();	
	
	try {
		if (imported_mp.encryption == "sjcl") {
			imported_private_key = sjcl.decrypt($("#import_password").val(), imported_mp.privateKey);
			on_success();
		} else if (imported_mp.encryption == "bip38") {
			if (confirm("Your browser may freeze for a moment during BIP38 decryption.  Continue?")) {
				$("#import_password_msg").css("color","green").text("BIP38 decrypting, please wait...");
				setTimeout(function() {	// delay encryption so message displays
					var decrypted = bip38.decrypt(imported_mp.privateKey, $("#import_password").val());
					
					// compare stated public address to derived public address to check password
					// TODO: would be nice if BIP38 did the password check instead, then publicAddress would not be needed
					var derived_public_address = bitcore.PrivateKey.fromWIF(decrypted).toAddress().toString();
					if (derived_public_address != imported_mp.publicAddress) {
						on_fail();
					} else {
						imported_private_key = decrypted;
						on_success();
					}
				}, 50);
			}
		} else {
			console.error("Invalid encryption scheme: " + imported_mp_encryption);
			on_fail();
		}
	} catch (err) {
		on_fail();
	}
	
	function on_fail() {
		$("#import_password_msg").css("color","red").text("Password is incorrect, try again.");
		$("#import_password").val("");
		$("#import_password").focus();
	}
	
	function on_success() {
		imported_public_address = bitcore.PrivateKey.fromWIF(imported_private_key).toAddress().toString();
		$("#import_password_msg").text("");
		unlocked_mp_balance = null;
		page_manager.next("unlocked_page");
	}
}

/**
 * Called with the latest network info for the imported mp.
 */
function on_imported_balance(err, amt, utxos, tx) {
	if (err != null) {
		set_online(false);
		return;
	}
	if (!online) set_online(true);
	
	// save network info
	imported_network_info.err = err;
	imported_network_info.amt = amt;
	imported_network_info.utxos = utxos;
	imported_network_info.tx = tx;
	
	// if no change, done
	if (unlocked_mp_balance == amt) return;
	unlocked_mp_balance = amt;
	
	// update balance fields
	update_imported_balances(unlocked_mp_balance);
	update_imported_buttons();
	
	// check if new funds added on add page
	if (page_manager.current() == "unlocked_mp_add_page") {
		page_manager.next("unlocked_mp_add_done_page");
	}
}

function on_unit() {
	update_imported_balances(unlocked_mp_balance);
	update_new_mp_balances(new_mp_balance);
	if (page_manager.current() == "new_mp_add_page") on_new_mp_add_amt();
	if (page_manager.current() == "unlocked_mp_add_page") on_unlocked_mp_add_amt();
	if (page_manager.current() == "claim_address_page") on_claim_address_amt();
	if (page_manager.current() == "claim_mp_send_page") on_claim_mp_send_amt();
	update_unlocked_mp_unit_labels();
	update_new_mp_unit_labels();
	update_claim_address_unit_labels();
	update_claim_mp_send_unit_labels();
	if (get_unit_code() != "BTC" && get_unit_code() != "bits") {
		$("#fluctuate").show();
	} else {
		$("#fluctuate").hide();
	}
}

/**
 * Updates all balances for the imported mp.
 */
function update_imported_balances(amt_satoshis) {
	var amt_str = online ? satoshis_to_unit_str(amt_satoshis) : "unavailable";
	var color = online ? "green" : "red";
	$("#unlocked_balance").css("color", color).text(amt_str);
	$("#claim_mp_send_balance").css("color", color).text(amt_str);
	$("#claim_address_balance").css("color", color).text(amt_str);
	$("#unlocked_mp_add_done_balance").css("color", color).text(amt_str);
	$("#claim_address_done_balance").css("color", color).text(amt_str);
	$("#claim_mp_done_old_balance").css("color", color).text(amt_str);
	if (imported_network_info != null && imported_network_info.tx != null) {
		$("#claim_address_fee").css("color","green").text(satoshis_to_unit_str(imported_network_info.tx.getFee(), 2));
		$("#claim_mp_send_fee").css("color","green").text(satoshis_to_unit_str(imported_network_info.tx.getFee(), 2));
	} else {
		$("#claim_address_fee").css("color","red").text("unavailable");
		$("#claim_mp_send_fee").css("color","red").text("unavailable");
	}
}

function update_new_mp_balances(amt_satoshis) {
	var amt_str = online ? satoshis_to_unit_str(amt_satoshis) : "unavailable";
	var color = online ? "green" : "red";
	$("#new_mp_add_done_balance").css("color", color).text(amt_str);
}

function update_unlocked_mp_unit_labels() {
	var symbol = get_currency_symbol(get_unit_code());
	if (symbol != null) {
		$("#unlocked_mp_add_symbol").text(symbol);
		$("#unlocked_mp_add_code").text("");
	} else {
		$("#unlocked_mp_add_symbol").text("");
		$("#unlocked_mp_add_code").text(get_unit_code());
	}
}

function update_new_mp_unit_labels() {
	var symbol = get_currency_symbol(get_unit_code());
	if (symbol != null) {
		$("#new_mp_add_symbol").text(symbol);
		$("#new_mp_add_code").text("");
	} else {
		$("#new_mp_add_symbol").text("");
		$("#new_mp_add_code").text(get_unit_code());
	}
}

function update_claim_address_unit_labels() {
	var symbol = get_currency_symbol(get_unit_code());
	if (symbol != null) {
		$("#claim_address_symbol").text(symbol);
		$("#claim_address_code").text("");
	} else {
		$("#claim_address_symbol").text("");
		$("#claim_address_code").text(get_unit_code());
	}
}

function update_claim_mp_send_unit_labels() {
	var symbol = get_currency_symbol(get_unit_code());
	if (symbol != null) {
		$("#claim_mp_send_symbol").text(symbol);
		$("#claim_mp_send_code").text("");
	} else {
		$("#claim_mp_send_symbol").text("");
		$("#claim_mp_send_code").text(get_unit_code());
	}
}

/**
 * Sets the password and generates a claim mp.
 * 
 * DUPLICATE BELOW
 */
function on_claim_mp_set_password() {
	var password1 = $("#claim_mp_password1");
	var password2 = $("#claim_mp_password2");
	var valid = validate_passwords(password1.val(), password2.val());
	if (valid == "Valid") {
		$("#claim_mp_password_msg").text("");
		
		// confirm starting new packet
		if (claim_mp != null) {
			if (!confirm("You already started a money packet to transfer funds to.  Discard and start a new one?")) return;
			claim_mp = null;
			page_manager.clear_nexts();
		}
		
		// generate private key for claim mp
		var claim_mp_private_key = bitcore.PrivateKey();
		claim_mp_public_address = claim_mp_private_key.toAddress().toString();
		if ($("#claim_mp_bip38_checkbox").is(":checked")) {
			if (confirm("Your browser may freeze for a moment during BIP38 encryption.  Continue?")) {
				$("#claim_mp_password_msg").css("color","green").text("BIP38 encrypting, please wait...");
				setTimeout(function() {	// hack to show encrypting message
					claim_mp = {};
					claim_mp["publicAddress"] = claim_mp_private_key.toAddress().toString();
					claim_mp["privateKey"] = bip38.encrypt(claim_mp_private_key.toWIF(), password1.val(), claim_mp_private_key.toAddress().toString());
					claim_mp["encryption"] = "bip38";
					page_manager.next("claim_mp_download_page");
					$("#claim_mp_password_msg").css("color","black").text("");
				}, 50);
			}
		} else {
			claim_mp = {};
			claim_mp["privateKey"] = sjcl.encrypt(password1.val(), claim_mp_private_key.toWIF(), { iter:DEFAULT_ITER });
			claim_mp["encryption"] = "sjcl";
			page_manager.next("claim_mp_download_page");
		}
	} else {
		$("#claim_mp_password_msg").text(valid);
		password1.val("");
		password2.val("");
		password1.focus();
	}
}

/**
 * Sets the password and generates a new mp.
 */
function on_new_mp_set_password() {
	// TODO: make this completely transparent
	if (bitcore == null || insight == null) {
		alert("Sorry, some dependencies are not loaded.  Please wait a moment and try again.");
		return;
	}
	
	var password1 = $("#new_mp_password1");
	var password2 = $("#new_mp_password2");
	var valid = validate_passwords(password1.val(), password2.val());
	if (valid == "Valid") {
		$("#new_mp_password_msg").text("");
		
		// confirm starting new packet
		if (new_mp != null) {
			if (!confirm("You already started a new money packet.  Discard and start a new one?")) return;
			new_mp = null;
			page_manager.clear_nexts();
		}
		
		// generate private key for new mp
		new_mp_private_key = bitcore.PrivateKey();
		new_mp_public_address = new_mp_private_key.toAddress().toString();
		if ($("#new_mp_bip38_checkbox").is(":checked")) {
			if (confirm("Your browser may freeze for a moment during BIP38 encryption.  Continue?")) {
				$("#new_mp_password_msg").css("color","green").text("BIP38 encrypting, please wait...");
				setTimeout(function() {	// hack to show encrypting message
					new_mp = {};
					new_mp["publicAddress"] = new_mp_private_key.toAddress().toString();
					new_mp["privateKey"] = bip38.encrypt(new_mp_private_key.toWIF(), password1.val(), new_mp_private_key.toAddress().toString());
					new_mp["encryption"] = "bip38";
					page_manager.next("new_mp_download_page");
					$("#new_mp_password_msg").css("color","black").text("");
				}, 50);
			}
		} else {
			new_mp = {};
			new_mp["privateKey"] = sjcl.encrypt(password1.val(), new_mp_private_key.toWIF(), { iter:DEFAULT_ITER });
			new_mp["encryption"] = "sjcl";
			page_manager.next("new_mp_download_page");
		}
	} else {
		$("#new_mp_password_msg").css("color","red").text(valid);
		password1.val("");
		password2.val("");
		password1.focus();
	}
}

/**
 * Downloads the claim mp.
 * 
 * DUPLICATE BELOW
 */
function on_claim_mp_download() {
	if (isIE) {
		window.navigator.msSaveBlob(new Blob([get_mp_text(claim_mp)]), get_mp_name());
	} else {
		var a = window.document.createElement('a');
		a.href = window.URL.createObjectURL(new Blob([get_mp_text(claim_mp)], {type: 'text/plain'}));
		a.download = get_mp_name();
		a.target="_blank";
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}
	$("#claim_mp_download_confirm_button").show();
}

/**
 * Downloads the new mp.
 */
function on_new_mp_download() {
	if (isIE) {
		window.navigator.msSaveBlob(new Blob([get_mp_text(new_mp)]), get_mp_name());
	} else {
		var a = window.document.createElement('a');
		a.href = window.URL.createObjectURL(new Blob([get_mp_text(new_mp)], {type: 'text/plain'}));
		a.download = get_mp_name();
		a.target="_blank";
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}
	$("#new_mp_download_confirm_button").show();
}

function get_mp_text(mp) {
	var date = new Date();
	var year = date.getFullYear() - 2000;
	var month = date.getMonth() + 1;
	if (month < 10) month = "0" + month;
	var day = date.getDate();
	if (day < 10) day = "0" + day;
	var str = "";
	//str += "Created on " + month + "/" + day + "/" + year + ".\n";
	str += "This is a money packet envelope for bitcoins.\n";
	str += "Funds can be claimed at https://moneypacket.org.\n";
	str += "You can modify this file, but DO NOT modify the text below.\n\n";
	str += "========== DO NOT MODIFY ==========\n";
	str += JSON.stringify(mp) + "\n";
	str += "===================================";
	return str;
}

function get_mp_name() {
	var date = new Date();
	var year = date.getFullYear() - 2000;
	var month = date.getMonth() + 1;
	if (month < 10) month = "0" + month;
	var day = date.getDate();
	if (day < 10) day = "0" + day;
	var hour = date.getHours();
	if (hour < 10) hour = "0" + hour;
	var min = date.getMinutes();
	if (min < 10) min = "0" + min;
	var sec = date.getSeconds();
	if (sec < 10) sec = "0" + sec;
	return "money_" + year + month + day + hour + min + ".txt";
}

/**
 * Confirms that the user has downloaded the claim mp to proceed.
 * 
 * DUPLICATE BELOW
 */
function on_claim_mp_download_confirm_button() {
	page_manager.next("claim_mp_send_page");
}

/**
 * Confirms that the user has downloaded the new mp to proceed.
 */
function on_new_mp_download_confirm_button() {
	page_manager.next("new_mp_add_page");
}

/**
 * Confirms that the user has copy/pasted the claim mp to proceed.
 * 
 * DUPLICATE BELOW
 */
function on_claim_mp_copy_confirm_button() {
	page_manager.next("claim_mp_send_page");
}

/**
 * Confirms that the user has copy/pasted the new mp to proceed.
 */
function on_new_mp_copy_confirm_button() {
	page_manager.next("new_mp_add_page");
}

function on_claim_mp_send() {
	var send_msg = $("#claim_mp_send_msg");
	if (imported_network_info == null) {
		send_msg.css("color", "red").text("Unable to get money packet network info");
	} else if (imported_network_info.err != null) {
		send_msg.css("color", "red").text("Network error: " + imported_network_info.err);
	} else {
		var send_amt_str = $("#claim_mp_send_amt").val();
		var balance = imported_network_info.amt;
		var tx = imported_network_info.tx;
		var tx_fee = tx.getFee();
		var msg = validate_transfer_amt(send_amt_str, balance, tx_fee);
		if (msg != "Valid") {
			$("#claim_mp_send_amt_error").css("color","red").text(msg);
		} else {
			var send_amt = parseFloat(send_amt_str);
			if (!confirm("Transfer " + satoshis_to_unit_str(unit_to_satoshis(send_amt)) + " to your new money packet?")) return;
			tx.to(claim_mp_public_address, unit_to_satoshis(send_amt, 0)).sign(imported_private_key);
			try {
				insight.broadcast(tx, function(err, txid) {
			    	if (err) {
			    		throw err;
			    	} else {
			    		send_msg.text("");
			    		$("#claim_mp_done_old_balance").css("color", "black").text("..");
			    		$("#claim_mp_done_transfer_amt").css("color", "green").text(satoshis_to_unit_str(unit_to_satoshis(send_amt)));
			    		page_manager.next("claim_mp_done_page");
			    	}
			    });
		    } catch(err) {
		    	if (err.toString().indexOf("Dust amount") != -1) {
	    			send_msg.css("color", "red").text("Send amount is too small.");
	    		} else {
	    			send_msg.css("color", "red").text("Error sending funds: " + err.toString());
	    		}
		    }
		}
	}
}

/**
 * Handles when user types amount into claim mp send page.
 */
function on_claim_mp_send_amt() {
	if (!online) return;
	var amt_str = $("#claim_mp_send_amt").val();
	var balance = imported_network_info.amt;
	var tx = imported_network_info.tx;
	var tx_fee = tx.getFee();
	var msg = validate_transfer_amt(amt_str, balance, tx_fee);
	if (msg == "Amount is not a number" ||
		msg == "Not enough funds" ||
		msg == "Not enough funds with transaction fee") {
		$("#claim_mp_send_amt_error").css("color","red").text(msg);
	} else {
		$("#claim_mp_send_amt_error").text("");
	}
	update_claim_mp_send_button();
}

function on_claim_address() {
	var checkmark = $("#claim_address_checkmark");
	var address = $("#claim_address").val();
	var msg = $("#claim_address_msg");
	$("#claim_address_full_balance").attr("disabled", "disabled");
	if (address == "") {
		checkmark.hide();
		clear_canvas("claim_address_checkmark");
		msg.text("");
	} else {
		var valid = validate_address(address);
		if (valid == "Valid") {
			checkmark.show();
			draw_checkmark("claim_address_checkmark");
			msg.text("");
			$("#claim_address_full_balance").removeAttr("disabled");
		} else {
			checkmark.hide();
			clear_canvas("claim_address_checkmark");
			msg.css("color","red").text(valid);
		}
	}
	update_claim_address_send_button();
}

/**
 * Handles when a user types amount into claim address send page.
 */
function on_claim_address_amt() {
	if (!online) return;
	var amt_str = $("#claim_address_amt").val();
	var balance = imported_network_info.amt;
	var tx = imported_network_info.tx;
	var tx_fee = tx.getFee();
	var msg = validate_transfer_amt(amt_str, balance, tx_fee);
	if (msg == "Amount is not a number" ||
		msg == "Not enough funds" ||
		msg == "Not enough funds with transaction fee") {
		$("#claim_address_amt_msg").css("color","red").text(msg);
	} else {
		$("#claim_address_amt_msg").text("");
	}
	update_claim_address_send_button();
}

function update_claim_mp_send_button() {
	if (!online) {
		$("#claim_mp_send_button").attr("disabled", "disabled");
		return;
	}
	var valid = true;
	if (imported_network_info == null) valid = false;
	if (imported_network_info.err != null) valid = false;
	var send_amt_str = $("#claim_mp_send_amt").val();
	var balance = imported_network_info.amt;
	var tx = imported_network_info.tx;
	var tx_fee = tx.getFee();
	var msg = validate_transfer_amt(send_amt_str, balance, tx_fee);
	if (msg != "Valid") valid = false;
	if (valid) $("#claim_mp_send_button").removeAttr("disabled");
	else $("#claim_mp_send_button").attr("disabled", "disabled");
}

function update_claim_address_send_button() {
	if (!online || imported_network_info == null || imported_network_info.tx == null) {
		$("#claim_address_send_button").attr("disabled", "disabled");
		return;
	}
	var send_address = $("#claim_address").val();
	var send_amt_str = $("#claim_address_amt").val();
	var balance = imported_network_info.amt;
	var tx = imported_network_info.tx;
	var tx_fee = tx.getFee();
	var address_msg = validate_address(send_address);
	var amt_msg = validate_transfer_amt(send_amt_str, balance, tx_fee);
	if (address_msg == "Valid" && amt_msg == "Valid") {
		$("#claim_address_send_button").removeAttr("disabled");
	} else {
		$("#claim_address_send_button").attr("disabled", "disabled");
	}
}

function on_claim_mp_send_full_balance() {
	if (!online) return;
	var send_msg = $("#claim_mp_send_msg");
	if (imported_network_info == null) {
		send_msg.css("color", "red").text("Unable to get money packet network info");
	} else if (imported_network_info.err != null) {
		send_msg.css("color", "red").text("Network error: " + imported_network_info.err);
	} else {
		var send_amt = get_max_claim_amt();
		var balance = imported_network_info.amt;
		var tx = imported_network_info.tx;
		var tx_fee = tx.getFee();
		if (send_amt == 0) {
			$("#claim_mp_send_amt_error").css("color","red").text("Insufficient funds to make transaction");
		} else {
			if (!confirm("Transfer the full balance to your new money packet?")) return;
			tx.to(claim_mp_public_address, send_amt).sign(imported_private_key);
			try {
				insight.broadcast(tx, function(err, txid) {
			    	if (err) {
			    		throw err;
			    	} else {
			    		send_msg.text("");
			    		$("#claim_mp_done_old_balance").css("color", "black").text("..");
			    		$("#claim_mp_done_transfer_amt").css("color", "green").text(satoshis_to_unit_str(send_amt));
			    		page_manager.next("claim_mp_done_page");
			    	}
			    });
		    } catch(err) {
		    	if (err.toString().indexOf("Dust amount") != -1) {
	    			send_msg.css("color", "red").text("Send amount is too small.");
	    		} else {
	    			send_msg.css("color", "red").text("Error sending funds: " + err.toString());
	    		}
		    }
		}
	}
}

function on_claim_address_full_balance() {
	if (!online) return;
	var send_msg = $("#claim_address_send_msg");
	if (imported_network_info == null) {
		send_msg.css("color", "red").text("Unable to get money packet network info");
	} else if (imported_network_info.err != null) {
		send_msg.css("color", "red").text("Network error: " + imported_network_info.err);
	} else {
		var send_address = $("#claim_address").val();
		var send_amt = get_max_claim_amt();
		var balance = imported_network_info.amt;
		var tx = imported_network_info.tx;
		var tx_fee = tx.getFee();
		var address_msg = validate_address(send_address);
		if (send_amt == 0) {
			$("#claim_address_amt_msg").css("color", "red").text("Insufficient funds to make transaction");
		} else if (address_msg == "Valid") {
    		$("#claim_address_amt_msg").text("");
			if (!confirm("Send the full balance to " + send_address + "?")) return;
			tx.to(send_address, send_amt).sign(imported_private_key);
			try {
				insight.broadcast(tx, function(err, txid) {
			    	if (err) {
			    		throw err;
			    	} else {
			    		send_msg.text("");
			    		$("#claim_address_done_transfer_amt").css("color", "green").text(satoshis_to_unit_str(send_amt));
			    		$("#claim_address_done_address").text(send_address);
			    		$("#claim_address_done_balance").css("color","black").text("..");
			    		page_manager.next("claim_address_done_page");
			    	}
			    });
		    } catch(err) {
		    	if (err.toString().indexOf("Dust amount") != -1) {
	    			send_msg.css("color", "red").text("Send amount is too small.");
	    		} else {
	    			send_msg.css("color", "red").text("Error sending funds: " + err.toString());
	    		}
		    }
		} else {
			$("#claim_address_msg").css("color","red").text(address_msg);
		}
	}
}

function get_max_claim_amt() {
	return Math.max(0, imported_network_info.amt - imported_network_info.tx.getFee());
}

function on_claim_address_send() {
	var send_msg = $("#claim_address_send_msg");
	if (imported_network_info == null) {
		send_msg.css("color", "red").text("Unable to get money packet network info");
	} else if (imported_network_info.err != null) {
		send_msg.css("color", "red").text("Network error: " + imported_network_info.err);
	} else {
		var send_address = $("#claim_address").val();
		var send_amt_str = $("#claim_address_amt").val();
		var balance = imported_network_info.amt;
		var tx = imported_network_info.tx;
		var tx_fee = tx.getFee();
		var address_msg = validate_address(send_address);
		var amt_msg = validate_transfer_amt(send_amt_str, balance, tx_fee);
		if (address_msg == "Valid" && amt_msg == "Valid") {
			var send_amt = parseFloat(send_amt_str);
			if (!confirm("Transfer " + satoshis_to_unit_str(unit_to_satoshis(send_amt)) + " to " + send_address + "?")) return;
			tx.to(send_address, unit_to_satoshis(send_amt, 0)).sign(imported_private_key);
			try {
				insight.broadcast(tx, function(err, txid) {
			    	if (err) {
			    		throw err;
			    	} else {
			    		send_msg.text("");
			    		$("#claim_address_done_transfer_amt").css("color", "green").text(satoshis_to_unit_str(unit_to_satoshis(send_amt)));
			    		$("#claim_address_done_address").text(send_address);
			    		$("#claim_address_done_balance").css("color","black").text("..");
			    		page_manager.next("claim_address_done_page");
			    	}
			    });
		    } catch(err) {
		    	if (err.toString().indexOf("Dust amount") != -1) {
	    			send_msg.css("color", "red").text("Send amount is too small.");
	    		} else {
	    			send_msg.css("color", "red").text("Error sending funds: " + err.toString());
	    		}
		    }
		} else {
			if (address_msg != "Valid") $("#claim_address_msg").css("color","red").text(address_msg);
			if (amt_msg != "Valid") $("#claim_address_amt_msg").css("color","red").text(amt_msg);
		}
	}
}

/**
 * Handles when user types amount into unlocked mp add funds page.
 * 
 * DUPLICATE BELOW
 */
function on_unlocked_mp_add_amt() {
	var amt = $("#unlocked_mp_add_amt").val();
	var msg = validate_positive_amt(amt);
	var error = $("#unlocked_mp_add_amt_error");
	if (msg == "Valid") {
		error.text("");
		var amt_num = satoshis_to_btc(unit_to_satoshis(parseFloat(amt)));
		$("#unlocked_mp_add_btc_conversion").text(amt_num + " BTC");
		
		// incorporate into QR code
		$("#unlocked_mp_qrcode").empty();
		$("#unlocked_mp_qrcode").attr("href", "bitcoin:" + imported_public_address + "?amount=" + amt_num);
		new QRCode("unlocked_mp_qrcode", {
			text:"bitcoin:" + imported_public_address + "?amount=" + amt_num,
			width:125,
			height:125
		});
	} else {
		// TODO: this logic misses negative values which should be flagged in real time
		if (amt != "." && msg == "Amount is not a number") {
			error.css("color", "red").text(msg);
		} else {
			error.text("");
		}
		$("#unlocked_mp_add_btc_conversion").html("&nbsp;");
		
		// remove from QR code
		$("#unlocked_mp_qrcode").empty();
		$("#unlocked_mp_qrcode").attr("href", "bitcoin:" + imported_public_address);
		new QRCode("unlocked_mp_qrcode", {
			text:"bitcoin:" + imported_public_address,
			width:125,
			height:125
		});
	}
}

/**
 * Handles when user types amount into new mp add funds page.
 */
function on_new_mp_add_amt() {
	var amt = $("#new_mp_add_amt").val();
	var msg = validate_positive_amt(amt);
	var error = $("#new_mp_add_amt_error");
	if (msg == "Valid") {
		error.text("");
		var amt_num = satoshis_to_btc(unit_to_satoshis(parseFloat(amt)));
		$("#new_mp_add_btc_conversion").text(amt_num + " BTC");
		
		// redraw into QR code
		$("#new_mp_qrcode").empty();
		$("#new_mp_qrcode").attr("href", "bitcoin:" + new_mp_public_address + "?amount=" + amt_num);
		new QRCode("new_mp_qrcode", {
			text:"bitcoin:" + new_mp_public_address + "?amount=" + amt_num,
			width:125,
			height:125
		});
	} else {
		if (amt != "." && msg == "Amount is not a number") {
			error.css("color", "red").text(msg);
		} else {
			error.text("");
		}
		$("#new_mp_add_btc_conversion").html("&nbsp;");
		
		// redraw from QR code
		$("#new_mp_qrcode").empty();
		$("#new_mp_qrcode").attr("href", "bitcoin:" + new_mp_public_address);
		new QRCode("new_mp_qrcode", {
			text:"bitcoin:" + new_mp_public_address,
			width:125,
			height:125
		});
	}
}

function on_new_mp_balance(err, amt, utxos, tx) {
	if (err != null) {
		set_online(false);
		return;
	}
	if (!online) set_online(true);
	
	// save network info
	new_mp_network_info.err = err;
	new_mp_network_info.amt = amt;
	new_mp_network_info.utxos = utxos;
	new_mp_network_info.tx = tx;
	
	// if balances are the same, done
	if (new_mp_balance == amt) return;
	
	// determine if funds were received
	var received = amt > new_mp_balance ? true : false;
	
	// update new balances
	new_mp_balance = amt;
	update_new_mp_balances(new_mp_balance);
	
	// process received funds
	if (received) on_new_mp_funds_received();
}

function on_new_mp_funds_received() {
	// process tip if selected
	if (tip_selection == "tip1") {
		var tx = new_mp_network_info.tx;
		var tx_fee = tx.getFee();
		var tip_amt = Math.min(unit_to_satoshis(DEFAULT_TIP, DEFAULT_TIP_UNIT), new_mp_balance);
		if (tip_amt - tx_fee > 0) {
			new_mp_add_done_tip = true;
			update_new_mp_balances(new_mp_balance - tip_amt);
			tx.to(TIP_ADDRESS, tip_amt - tx_fee).sign(new_mp_private_key);
			try {
				insight.broadcast(tx, function(err, txid) {
					if (err) {
						throw err;
					}
				});
			} catch (err) {
				console.log("Error processing tip: " + err);
			}
		}
	} else {
		new_mp_add_done_tip = false;
	}
	
	// advance page if new funds received
	if (page_manager.current() == "new_mp_add_page") {
		page_manager.next("new_mp_add_done_page");
	}
}

function satoshis_to_unit_str(amt, decimals) {
	if (decimals == null) decimals = 2;
	if (get_unit_code() == "BTC") return satoshis_to_unit(amt) + " BTC";
	if (get_unit_code() == "bits") return satoshis_to_unit(amt).toFixed(0) + " bits";
	var symbol = get_currency_symbol(get_unit_code());
	if (symbol != null) {
		return symbol + satoshis_to_unit(amt).toFixed(decimals);
	} else {
		return satoshis_to_unit(amt).toFixed(decimals) + " " + get_unit_code();
	}
}

function satoshis_to_unit(amt, decimals) {
	var converted = amt / 100000000 * get_exchange_rate(get_unit_code());	// TODO: use number library
	return decimals == null ? converted : parseFloat(converted.toFixed(decimals));
}

function unit_to_satoshis(amt, decimals) {
	var converted = amt / get_exchange_rate(get_unit_code()) * 100000000;	// TODO: use number library
	return decimals == null ? converted : parseFloat(converted.toFixed(decimals));
}

// TODO: this shouldn't be necessary, unit_to_satashis should take code as parameter
function unit_to_satoshis_custom(amt, code, decimals) {
	var converted = amt / get_exchange_rate(code) * 100000000;				// TODO: use number library
	return decimals == null ? converted : parseFloat(converted.toFixed(decimals));
}

function get_unit_code() {
	return $("#preferred_unit_select :selected").val();
}

function get_exchange_rate(code) {
	if (code == "bits") return 1000000.0;
	if (code == "BTC") return 1.0;
	for (var i = 0; i < exchange_rates.length; i++) {
		if (exchange_rates[i].code == code) return exchange_rates[i].rate;
	}
	return null;
}

function set_online(is_online) {
	online = is_online;
	update_imported_buttons();
	if (online) {
		update_exchange_rates();
		$("#offline_div").hide();
		$("#new_mp_add_waiting").css("color","green").text("Waiting for funds...");
		$("#unlocked_mp_add_waiting").css("color","green").text("Waiting for funds...");
	} else {
		$("#offline_div").show();
		$("#new_mp_add_waiting").css("color","black").text("Cannot detect funds while offline");
		$("#unlocked_mp_add_waiting").css("color","black").text("Cannot detect funds while offline");
	}
	update_imported_balances(unlocked_mp_balance);
	update_new_mp_balances(new_mp_balance);
}

function update_imported_buttons() {
	if (!online || unlocked_mp_balance == 0) {
		$("#unlocked_claim_mp_link").attr("disabled", "disabled");
		$("#unlocked_claim_address_link").attr("disabled", "disabled");
	} else {
		$("#unlocked_claim_mp_link").removeAttr("disabled");
		$("#unlocked_claim_address_link").removeAttr("disabled");
	}
}

function on_new_mp_advanced_link() {
	var displayed = $("#new_mp_advanced_div").css("display") != "none"
	$("#new_mp_advanced_link").text(displayed ? "\u25b8 Advanced" : "\u25be Advanced");
	displayed ? $("#new_mp_advanced_div").hide() : $("#new_mp_advanced_div").show();
}

function on_claim_mp_advanced_link() {
	var displayed = $("#claim_mp_advanced_div").css("display") != "none"
	$("#claim_mp_advanced_link").text(displayed ? "\u25b8 Advanced" : "\u25be Advanced");
	displayed ? $("#claim_mp_advanced_div").hide() : $("#claim_mp_advanced_div").show();
}

function on_tip(id) {
	$(".tip_link").removeClass("active");
	$("#" + id).addClass("active");
	tip_selection = id;
}

// ------------------------------- UTILITIES ----------------------------

/**
 * Listens to an address's balance.
 */
function network_listener(address, update_interval, callback) {
	var listening = true;
	this.stop_listening = function() { listening = false; };
	this.listening = function() { return listening; };
	this.callback = function() { get_balance_utxos_tx(address, callback); };
	timer(this, update_interval);
}

/**
 * Repeatedly invokes the listener's callback each interval until
 * listener.stop() is true.
 */
function timer(listener, interval) {
	if (listener.listening()) {
		listener.callback();
		setTimeout(function() {
			timer(listener, interval);
		}, interval);
	}
}

/**
 * Repeatedly gets latest exchange rate data every update_interval ms.
 */
function exchange_rate_listener(update_interval) {
	this.listening = function() { return true; };
	this.callback = update_exchange_rates;
	timer(this, update_interval);
}

/**
 * Updates exchange rate data.
 */
function update_exchange_rates() {
	jQuery.getJSON("https://bitpay.com/api/rates", null, function(data, textStatus, jqXHR) {
		if (data != null) {
			var select = $("#preferred_unit_select");
			if (!exchange_rates) {
				data.forEach(function(obj) {
					if (obj.code != "BTC") select.append($("<option></option>").attr("value", obj.code).text(obj.code));
				});
				$("#preferred_unit_select option:contains('" + PREFERRED_UNIT_DEFAULT + "')").prop("selected", true);
				exchange_rates = data;
				on_unit();
			} else {
				exchange_rates = data;
			}
		}
	});
}

/**
 * Converts the given amount from satoshis to btc.
 */
function satoshis_to_btc(amt) {
	return bitcore.Unit.fromSatoshis(amt).toBTC();
}

/**
 * Converts the given amount from btc to satoshis.
 */
function btc_to_satoshis(amt) {
	return bitcore.Unit.fromBTC(amt).toSatoshis();
}

/**
 * Retrieves the UTXOs, balance, and prepared transaction for the given address.
 *
 * @param address is the address to retrieve for
 * @param callback(err, utxos, amt, tx)
 */
function get_balance_utxos_tx(address, callback) {
	insight.getUnspentUtxos(address, function(err, utxos) {
		if (err) {
			callback(err);
			return;
		}
		var amt = 0;
		for (var i = 0; i < utxos.length; i++) {
			amt += utxos[i].satoshis;
		}
		var tx = bitcore.Transaction().from(utxos).change(address);
		callback(null, amt, utxos, tx);
	});
}

/**
 * Validates two passwords.
 */
function validate_passwords(password1, password2) {
	if (password1 != password2) {
		return "The passwords you entered do not match";
	} else if (password1 == "") {	
		return "The password cannot be blank";
	} else if (password1.length < 6) {
		return "The password must contain at least 6 characters";
	} else if (!(/[a-z]/.test(password1))) {
		return "The password must contain at least 1 lowercase character";
	} else if (!(/[A-Z]/.test(password1))) {
		return "The password must contain at least 1 uppercase character";
	} else {
		return "Valid";
	}
}

/**
 * Validates a transfer amount based on available balance and transaction fee.
 * 
 * @param amt is the amount to transfer specified in the user's preferred unit
 * @param balance is the available balance in satoshis
 * @param tx_fee is the estimated transaction fee in satoshis
 */
function validate_transfer_amt(amt, balance, tx_fee) {
	var msg = validate_positive_amt(amt);
	if (msg != "Valid") return msg;
	
	// convert to float and satoshis
	var amt_num = unit_to_satoshis(parseFloat(amt));
	
	// verify amount relative to balance and tx fee
	if (balance == null) {
		console.error("Balance is null");
		return "Balance is null";
	} else if (tx_fee == null) {
		return "Transaction fee is null";
	} else if (amt_num > balance) {
		return "Not enough funds";
	} else if (amt_num > balance - tx_fee) {
		return "Not enough funds with transaction fee";
	} else {
		return "Valid";
	}
}

/**
 * Validates an amount as a positive float.
 */
function validate_positive_amt(amt) {
	if (amt == "" || amt == ".") return "Amount is blank";
	if (!$.isNumeric(amt)) return "Amount is not a number";
	var amt_num = parseFloat(amt);
	if (amt_num <= 0) return "Amount must be positive";
	return "Valid";
}

/**
 * Validates a bitcoin address.
*/
function validate_address(address) {
	if (address == "") {
		return "Address is blank"
	} else if (!bitcore.Address.isValid(address)) {
		return "Bitcoin address is not valid"
	} else {
		return "Valid";
	}
}

function get_currency_symbol(code) {
	var currency_symbols = {
	    'USD': '$', // US Dollar
	    'EUR': '€', // Euro
	    'CRC': '₡', // Costa Rican Colón
	    'GBP': '£', // British Pound Sterling
	    'ILS': '₪', // Israeli New Sheqel
	    'INR': '₹', // Indian Rupee
	    'JPY': '¥', // Japanese Yen
	    'KRW': '₩', // South Korean Won
	    'NGN': '₦', // Nigerian Naira
	    'PHP': '₱', // Philippine Peso
	    'PLN': 'zł', // Polish Zloty
	    'PYG': '₲', // Paraguayan Guarani
	    'THB': '฿', // Thai Baht
	    'UAH': '₴', // Ukrainian Hryvnia
	    'VND': '₫', // Vietnamese Dong
	};
	var symbol = currency_symbols[code];
	return symbol === undefined ? null : symbol;
} 

// --------------------------------- DRAW CHECKMARK ---------------------------

/**
 * Draws a checkmark in the given canvas by id.
 */
function draw_checkmark(canvas_id) {
	var start = 100;
	var mid = 145;
	var end = 250;
	var width = 22;
	var leftX = start;
	var leftY = start;
	var rightX = mid - (width / 2.7);
	var rightY = mid + (width / 2.7);
	var animationSpeed = 4;

	var ctx = document.getElementById(canvas_id).getContext('2d');
	ctx.lineWidth = width;
	ctx.strokeStyle = 'rgba(0, 150, 0, 1)';

	for (i = start; i < mid; i++) {
	    var drawLeft = window.setTimeout(function () {
	        ctx.beginPath();
	        ctx.moveTo(start, start);
	        ctx.lineTo(leftX, leftY);
	        ctx.stroke();
	        leftX++;
	        leftY++;
	    }, 1 + (i * animationSpeed) / 3);
	}

	for (i = mid; i < end; i++) {
	    var drawRight = window.setTimeout(function () {
	        ctx.beginPath();
	        ctx.moveTo(leftX, leftY);
	        ctx.lineTo(rightX, rightY);
	        ctx.stroke();
	        rightX++;
	        rightY--;
	    }, 1 + (i * animationSpeed) / 3);
	}
}

/**
 * Clears the given canvas by id.
 */
function clear_canvas(canvas_id) {
	var canvas = document.getElementById(canvas_id);
	var ctx = canvas.getContext('2d');
	ctx.clearRect(0, 0, canvas.width, canvas.height)
}