let currentPollId = null;
let optionCount = 2;

function showView(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

function showCreate() {
    showView('create-view');
    document.getElementById('status-text').textContent = 'Create your first poll below';
}

async function launchPoll() {
    const question = document.getElementById('poll-question').value.trim();
    const optInputs = document.querySelectorAll('.opt-input');
    const options = Array.from(optInputs).map(i => i.value.trim()).filter(Boolean);

    if (!question) { showError('create-view', 'Please enter a question!'); return; }
    if (options.length < 2) { showError('create-view', 'Please add at least 2 options!'); return; }

    clearError('create-view');

    try {
        const res = await fetch('/api/polls', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, options })
        });

        if (!res.ok) throw new Error('Failed to create poll');
        const poll = await res.json();
        currentPollId = poll.id;
        await showVoteView(currentPollId);
    } catch (e) {
        showError('create-view', 'Could not create poll. Please try again.');
    }
}

async function showVoteView(pollId) {
    currentPollId = pollId;
    showView('vote-view');

    try {
        const res = await fetch(`/api/polls/${pollId}`);
        if (!res.ok) throw new Error('Poll not found');
        const poll = await res.json();

        document.getElementById('display-question').textContent = poll.question;
        document.getElementById('status-text').textContent = 'Cast your vote!';

        const container = document.getElementById('vote-options');
        container.innerHTML = '';

        const alreadyVotedOptionId = localStorage.getItem(`voted_${pollId}`);

        if (alreadyVotedOptionId) {
            showResults(poll);
            return;
        }

        poll.options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'vote-btn';
            btn.textContent = opt.text;
            btn.onclick = () => castVote(pollId, opt.id);
            container.appendChild(btn);
        });
    } catch (e) {
        showError('vote-view', 'Could not load poll.');
    }
}

async function castVote(pollId, optionId) {
    let voterToken = localStorage.getItem(`token_${pollId}`);
    if (!voterToken) {
        voterToken = 'vx-' + Math.random().toString(36).substr(2, 12) + Date.now();
        localStorage.setItem(`token_${pollId}`, voterToken);
    }

    const btns = document.querySelectorAll('.vote-btn');
    btns.forEach(b => { b.disabled = true; });

    try {
        const res = await fetch(`/api/polls/${pollId}/vote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ optionId, voterToken })
        });

        const data = await res.json();

        if (!res.ok) {
            showError('vote-view', data.error || 'Vote failed.');
            btns.forEach(b => { b.disabled = false; });
            return;
        }

        localStorage.setItem(`voted_${pollId}`, optionId);
        showResults(data);
    } catch (e) {
        showError('vote-view', 'Could not submit vote.');
        btns.forEach(b => { b.disabled = false; });
    }
}

function showResults(poll) {
    showView('result-view');
    document.getElementById('status-text').textContent = 'Votes are in!';

    const container = document.getElementById('results-display');
    container.innerHTML = '';

    const total = poll.totalVotes || poll.options.reduce((s, o) => s + o.voteCount, 0) || 1;

    poll.options.forEach(opt => {
        const pct = Math.round((opt.voteCount / total) * 100);

        const label = document.createElement('div');
        label.className = 'result-label';
        label.innerHTML = `<span>${opt.text}</span><span>${opt.voteCount} votes (${pct}%)</span>`;

        const bar = document.createElement('div');
        bar.className = 'result-bar';

        const fill = document.createElement('div');
        fill.className = 'fill';
        bar.appendChild(fill);

        container.appendChild(label);
        container.appendChild(bar);

        setTimeout(() => { fill.style.width = pct + '%'; }, 100);
    });

    // Auto-refresh results every 5 seconds
    if (window._refreshTimer) clearInterval(window._refreshTimer);
    window._refreshTimer = setInterval(async () => {
        if (document.getElementById('result-view').classList.contains('hidden')) {
            clearInterval(window._refreshTimer);
            return;
        }
        try {
            const res = await fetch(`/api/polls/${poll.id}`);
            if (res.ok) {
                const fresh = await res.json();
                showResults(fresh);
            }
        } catch (_) {}
    }, 5000);
}

function resetPoll() {
    if (window._refreshTimer) clearInterval(window._refreshTimer);
    currentPollId = null;
    optionCount = 2;

    document.getElementById('poll-question').value = '';

    const container = document.getElementById('options-inputs');
    container.innerHTML = `
        <input type="text" class="opt-input" id="opt1" placeholder="Option 1">
        <input type="text" class="opt-input" id="opt2" placeholder="Option 2">
    `;

    showCreate();
}

function addOption() {
    optionCount++;
    const container = document.getElementById('options-inputs');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'opt-input';
    input.placeholder = `Option ${optionCount}`;
    container.appendChild(input);
}

async function viewAllPolls() {
    showView('polls-view');
    document.getElementById('status-text').textContent = 'All active polls';

    const list = document.getElementById('polls-list');
    list.innerHTML = '<div class="loading">Loading polls...</div>';

    try {
        const res = await fetch('/api/polls');
        const polls = await res.json();

        list.innerHTML = '';

        if (polls.length === 0) {
            list.innerHTML = '<p style="opacity:0.6;font-size:0.9rem">No polls yet. Create one!</p>';
            return;
        }

        polls.forEach(poll => {
            const card = document.createElement('div');
            card.className = 'poll-card';
            card.innerHTML = `
                <p>${poll.question}</p>
                <span>${poll.totalVotes} vote${poll.totalVotes !== 1 ? 's' : ''}</span>
            `;
            card.onclick = () => showVoteView(poll.id);
            list.appendChild(card);
        });
    } catch (e) {
        list.innerHTML = '<div class="error-msg">Could not load polls.</div>';
    }
}

function showError(viewId, msg) {
    clearError(viewId);
    const el = document.createElement('div');
    el.className = 'error-msg';
    el.id = `error-${viewId}`;
    el.textContent = msg;
    document.getElementById(viewId).prepend(el);
}

function clearError(viewId) {
    const existing = document.getElementById(`error-${viewId}`);
    if (existing) existing.remove();
}
