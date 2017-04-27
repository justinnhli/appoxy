"use strict";

$(function () {
	var categories = []
	var questions = {};
	var numQuestions = 0;

	var $input = $('#input');
	var $board = $('#board');
	var $question = $('#question');
	var $answer = $('#answer');
	var $error = $('#error');

	var FADE_OUT_TIME = 200;
	var FADE_IN_TIME = 600;

	var hasErrors = false;

	function parseQuestions() {
		var lines = $('#editor').val().trim().split('\n');
		var category = '';
		var questionNum = 0;
		var question = '';
		var answer = '';
		for (var i = 0; i < lines.length; i++) {
			var line = lines[i].trim();
			if (line.startsWith('Q:')) {
				if (category && answer === '') {
					question = line.substr(2).trim();
					answer = '';
				} else {
					$error.append($('<p>You seem to either have a question outside any category, or have a question without an answer:<br>' + line + '</p>'));
					hasErrors = true;
				}
			} else if (line.startsWith('A:')) {
				if (category && question) {
					answer = line.substr(2).trim();
					questions[category].push({question:question, answer:answer});
					question = '';
					answer = ''
				} else {
					$error.append($('<p>You seem to either have an answer outside any category, or have an answer without a question:<br>' + line + '</p>'));
					hasErrors = true;
				}
			} else if (line) {
				if (question !== '' || answer !== '') {
					$error.append($('<p>You seem to have a question without an answer in the "' + category + '" category.</p>'));
					hasErrors = true;
				}
				category = line; 
				categories.push(category);
				questions[category] = [];
				question = '';
				answer = ''
			}
		}
	}

	function checkQuestions() {
		// are the number of questions the same between categories?
		numQuestions = -1;
		for (var i = 0; i < categories.length; i++) {
			var category = categories[i];
			if (numQuestions === -1) {
				numQuestions = questions[category].length;
			} else if (numQuestions !== questions[category].length) {
				$error.append($('<p>The "' + category + '" category seems to have ' + numQuestions + ' questions, when the first category has ' + questions[category].length + '.<p>'));
				hasErrors = true;
			}
		}
		// add coords for all questions
		for (var row = 0; row < numQuestions; row++) {
			for (var col = 0; col < categories.length; col++) {
				var category = categories[col];
				var question = questions[category][row];
				question.coord = row + '_' + col;
			}
		}
	}

	function showBoard() {
		var html = '';
		html += '<table id="grid">';
		// create board header
		html += '<tr>';
		for (var i = 0; i < categories.length; i++) {
			html += '<th>' + categories[i] + '</th>';
		}
		html += '</tr>';
		// create board questions
		for (var row = 0; row < numQuestions; row++) {
			html += '<tr>';
			for (var col = 0; col < categories.length; col++) {
				var category = categories[col];
				html += '<td id="board_' + questions[category][row].coord + '">$' + (row + 1) * 100 + '</td>';
			}
			html += '</tr>';
		}
		html += '</table>';

		$board.empty();
		$board.append($(html));
		$board.append($('<p></p><p><span id="end">X</span></p>'));
		$('#grid td').css({cursor: 'pointer'}).on('click', boardOnClick);
		$('#board p span').on('click', endGame);
		$input.fadeOut(FADE_OUT_TIME);
		$board.fadeIn(FADE_IN_TIME);
	}

	function boardOnClick(e) {
		var td = $(e.currentTarget)
		var coord = td.attr('id').split('_');
		var row = parseInt(coord[1]);
		var col = parseInt(coord[2]);
		var category = categories[col]
		var question = questions[category][row];
		td.css({
			color: td.css('background-color'),
			cursor: 'default',
		});
		showQuestion(question);
	}

	function showQuestion(question) {
		$question.html('<span id="question_' + question.coord + '">' + question.question.toUpperCase() + '</span>');
		$board.fadeOut(FADE_OUT_TIME);
		$question.fadeIn(FADE_IN_TIME);
		$('#question span').css('cursor', 'pointer').on('click', questionOnClick);
	}

	function questionOnClick(e) {
		var coord = $(e.currentTarget).attr('id').split('_');
		var row = parseInt(coord[1]);
		var col = parseInt(coord[2]);
		var category = categories[col]
		var question = questions[category][row];
		showAnswer(question);
	}

	function showAnswer(question) {
		$answer.html('<span>' + question.answer.toUpperCase() + '</span>');
		$question.fadeOut(FADE_OUT_TIME);
		$answer.fadeIn(FADE_IN_TIME);
		$('#answer span').css('cursor', 'pointer').on('click', answerOnClick);
	}

	function answerOnClick(e) {
		$answer.fadeOut(FADE_OUT_TIME);
		$board.fadeIn(FADE_IN_TIME);
	}

	function reset() {
		categories = []
		questions = {};
		numQuestions = 0;
		hasErrors = false;
		$error.empty();
	}

	function startGame() {
		parseQuestions();
		checkQuestions();
		if (!hasErrors) {
			showBoard();
			$('body').css('background-color', '#0E188E');
		}
	}

	function endGame() {
		$board.fadeOut(FADE_OUT_TIME);
		$input.fadeIn(FADE_IN_TIME);
		categories = [];
		questions = {};
		numQuestions = 0;
		$('body').css('background-color', '#FFFFFF');
	}

	function main() {
		$('#start').on('click', startGame);
		var height = $(document).height();
		var width = $(document).width();
		$board.css('min-width', width);
		$board.css('min-height', height);
		$question.css('min-width', width);
		$question.css('min-height', height);
		$answer.css('min-width', width);
		$answer.css('min-height', height);

		$board.fadeOut(0);
		$question.fadeOut(0);
		$answer.fadeOut(0);
	}

	main();
});
