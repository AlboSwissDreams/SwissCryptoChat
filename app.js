
(() => {
  'use strict';

  const SUPABASE_URL =
    'https://ydgsazdazubhrkquvhbw.supabase.co';

  const SUPABASE_PUBLISHABLE_KEY =
    'sb_publishable_b_-6srut4gOgN-8ZLcjBJw_FT76vS7H';

  const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );

  const $ = id => document.getElementById(id);
  let me = null;
  let activeUser = null;
  let people = [];
  let channel = null;

  const style = document.createElement('style');
  style.textContent = `
    #scc-auth {
      position:fixed; inset:0; z-index:99999;
      display:flex; align-items:center; justify-content:center;
      padding:20px; background:#080b16; color:#fff;
      font-family:Arial,sans-serif;
    }
    #scc-auth .panel {
      width:100%; max-width:400px; padding:24px;
      border:1px solid #00e5ff; border-radius:16px;
      background:#101629; box-sizing:border-box;
    }
    #scc-auth input, #scc-auth button {
      width:100%; box-sizing:border-box; padding:12px;
      margin-top:10px; border-radius:8px; font-size:15px;
    }
    #scc-auth input {
      color:#fff; background:#080b16; border:1px solid #45506c;
    }
    #scc-auth button {
      color:#061018; background:#00e5ff;
      border:0; font-weight:bold;
    }
    #scc-auth .secondary {
      background:transparent; color:#00e5ff;
      border:1px solid #00e5ff;
    }
    #scc-auth-status { white-space:pre-wrap; font-size:14px; }
    .scc-user {
      display:flex; align-items:center; gap:10px;
      padding:12px; cursor:pointer; border-bottom:1px solid #263047;
      color:inherit;
    }
    .scc-user:hover { background:#18243a; }
    .scc-bubble {
      padding:10px 13px; margin:8px 0; max-width:82%;
      border-radius:12px; overflow-wrap:anywhere;
      white-space:pre-wrap; color:#fff;
    }
    .scc-mine { margin-left:auto; background:#174c60; }
    .scc-theirs { margin-right:auto; background:#252b40; }
    #scc-account {
      position:fixed; z-index:1000; right:10px; top:10px;
      background:#101629; color:#00e5ff;
      border:1px solid #00e5ff; border-radius:8px; padding:8px;
    }
    #scc-delete {
      background:#5b2335; color:white; border:0;
      border-radius:7px; padding:8px; margin:5px;
    }
  `;
  document.head.appendChild(style);

  const auth = document.createElement('div');
  auth.id = 'scc-auth';
  auth.innerHTML = `
    <div class="panel">
      <h2 style="color:#00e5ff">SwissCryptoChat</h2>
      <p>Accedi o crea il tuo account.</p>
      <form id="scc-form">
        <input id="scc-username" placeholder="Username (solo registrazione)"
          minlength="3" maxlength="24" autocomplete="username">
        <input id="scc-email" type="email" placeholder="Email"
          required autocomplete="email">
        <input id="scc-password" type="password" placeholder="Password"
          required minlength="6" autocomplete="current-password">
        <button id="scc-submit" type="submit">Accedi</button>
      </form>
      <button id="scc-toggle" class="secondary" type="button">
        Crea un account
      </button>
      <p id="scc-auth-status"></p>
    </div>`;
  document.body.appendChild(auth);

  const account = document.createElement('button');
  account.id = 'scc-account';
  account.textContent = 'Esci';
  account.hidden = true;
  document.body.appendChild(account);

  let registering = false;
  const status = $('scc-auth-status');

  $('scc-toggle').onclick = () => {
    registering = !registering;
    $('scc-username').style.display = registering ? '' : 'none';
    $('scc-username').required = registering;
    $('scc-submit').textContent = registering
      ? 'Registrati' : 'Accedi';
    $('scc-toggle').textContent = registering
      ? 'Ho già un account' : 'Crea un account';
    status.textContent = '';
  };
  $('scc-username').style.display = 'none';

  function notify(message) {
    const toast = $('toastroot');
    if (toast) toast.textContent = message;
    else alert(message);
  }

  function escapeText(value) {
    return String(value ?? '');
  }

  async function start() {
    const result = await db.auth.getSession();
    if (result.error) throw result.error;
    if (result.data.session) {
      await enter(result.data.session.user);
    }
  }

  $('scc-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('scc-email').value.trim();
    const password = $('scc-password').value;
    const username = $('scc-username').value.trim().toLowerCase();

    status.textContent = 'Attendi...';
    $('scc-submit').disabled = true;

    try {
      let result;

      if (registering) {
        if (!/^[a-z0-9_]{3,24}$/.test(username)) {
          throw new Error(
            'Username: usa 3-24 caratteri, lettere minuscole, numeri o _.'
          );
        }

        result = await db.auth.signUp({
          email,
          password,
          options: { data: { username } }
        });

        if (result.error) throw result.error;

        if (!result.data.session) {
          status.textContent =
            'Registrazione inviata. Controlla la tua email e conferma ' +
            'l’account, se richiesto. Poi torna qui e accedi.';
          return;
        }

        await enter(result.data.user);
      } else {
        result = await db.auth.signInWithPassword({
          email, password
        });
        if (result.error) throw result.error;
        await enter(result.data.user);
      }
    } catch (err) {
      status.textContent = err.message || 'Operazione non riuscita.';
    } finally {
      $('scc-submit').disabled = false;
    }
  });

  async function enter(user) {
    me = user;
    auth.style.display = 'none';
    account.hidden = false;

    if ($('topavatar')) $('topavatar').textContent =
      (user.email || 'U').slice(0, 1).toUpperCase();

    if ($('chathead')) {
      $('chathead').textContent = 'Scegli un utente per iniziare';
    }
    if ($('messages')) $('messages').replaceChildren();

    await loadPeople();
    subscribe();
  }

  account.onclick = async () => {
    if (channel) await db.removeChannel(channel);
    channel = null;
    await db.auth.signOut();
    me = null;
    activeUser = null;
    account.hidden = true;
    auth.style.display = 'flex';
    status.textContent = 'Hai effettuato la disconnessione.';
  };

  async function loadPeople() {
    if (!me) return;

    const result = await db
      .from('profiles')
      .select('id, username')
      .neq('id', me.id)
      .order('username');

    if (result.error) {
      notify('Errore nel caricamento utenti: ' + result.error.message);
      return;
    }

    people = result.data || [];
    renderPeople();
  }

  function renderPeople() {
    const list = $('chatlist');
    if (!list) return;

    list.replaceChildren();

    const query = ($('search')?.value || '').trim().toLowerCase();
    const filtered = people.filter(p =>
      p.username.toLowerCase().includes(query)
    );

    if (!filtered.length) {
      const empty = document.createElement('p');
      empty.textContent = query
        ? 'Nessun utente trovato.'
        : 'Ancora nessun altro utente registrato.';
      list.appendChild(empty);
      return;
    }

    filtered.forEach(person => {
      const item = document.createElement('div');
      item.className = 'scc-user';
      item.textContent = '👤  @' + person.username;
      item.onclick = () => openConversation(person);
      if (activeUser?.id === person.id) {
        item.style.background = '#183348';
      }
      list.appendChild(item);
    });

    if ($('chatcount')) $('chatcount').textContent = String(filtered.length);
  }

  if ($('search')) {
    $('search').oninput = renderPeople;
  }

  ['newchat', 'addcontact'].forEach(id => {
    if ($(id)) $(id).onclick = () => {
      $('search')?.focus();
      notify('Cerca lo username della persona con cui vuoi chattare.');
    };
  });

  async function openConversation(person) {
    activeUser = person;
    renderPeople();

    if ($('chathead')) {
      $('chathead').replaceChildren();
      const name = document.createElement('strong');
      name.textContent = '@' + person.username;
      $('chathead').appendChild(name);

      const del = document.createElement('button');
      del.id = 'scc-delete';
      del.textContent = 'Elimina chat';
      del.onclick = deleteConversation;
      $('chathead').appendChild(del);
    }

    await loadMessages();
  }

  async function loadMessages() {
    if (!me || !activeUser || !$('messages')) return;

    const expression =
      'and(sender_id.eq.' + me.id + ',receiver_id.eq.' +
      activeUser.id + '),and(sender_id.eq.' + activeUser.id +
      ',receiver_id.eq.' + me.id + ')';

    const result = await db.from('messages')
      .select('id,sender_id,receiver_id,content,created_at')
      .or(expression)
      .order('created_at', { ascending: true })
      .limit(500);

    if (result.error) {
      notify('Errore nel caricamento messaggi: ' + result.error.message);
      return;
    }

    const box = $('messages');
    box.replaceChildren();

    (result.data || []).forEach(message => {
      const bubble = document.createElement('div');
      bubble.className = 'scc-bubble ' +
        (message.sender_id === me.id ? 'scc-mine' : 'scc-theirs');

      const body = document.createElement('div');
      body.textContent = escapeText(message.content);
      bubble.appendChild(body);

      const time = document.createElement('small');
      time.textContent = new Date(message.created_at).toLocaleString();
      time.style.opacity = '0.7';
      bubble.appendChild(time);

      box.appendChild(bubble);
    });

    box.scrollTop = box.scrollHeight;
  }

  async function sendMessage(e) {
    e.preventDefault();
    e.stopImmediatePropagation();

    if (!me || !activeUser) {
      notify('Prima scegli una persona dalla lista.');
      return;
    }

    const input = $('messageinput');
    const content = input?.value.trim();
    if (!content) return;

    const button = $('sendbtn');
    if (button) button.disabled = true;

    const result = await db.from('messages').insert({
      sender_id: me.id,
      receiver_id: activeUser.id,
      content: content.slice(0, 4000)
    });

    if (button) button.disabled = false;

    if (result.error) {
      notify('Invio non riuscito: ' + result.error.message);
      return;
    }

    input.value = '';
    await loadMessages();
  }

  const form = $('composeform');
  if (form) {
    form.addEventListener('submit', sendMessage, true);
  }

  async function deleteConversation() {
    if (!me || !activeUser) return;

    if (!confirm(
      'Eliminare tutti i messaggi di questa chat? ' +
      'Saranno eliminati anche per l’altra persona.'
    )) return;

    for (const [sender, receiver] of [
      [me.id, activeUser.id],
      [activeUser.id, me.id]
    ]) {
      const result = await db.from('messages')
        .delete()
        .eq('sender_id', sender)
        .eq('receiver_id', receiver);

      if (result.error) {
        notify('Errore durante la cancellazione: ' + result.error.message);
        return;
      }
    }

    await loadMessages();
    notify('Chat eliminata.');
  }

  function subscribe() {
    if (channel || !me) return;

    channel = db.channel('scc-messages-' + me.id)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: 'receiver_id=eq.' + me.id
      }, async () => {
        await loadPeople();
        if (activeUser) await loadMessages();
      })
      .subscribe();
  }

  // Nasconde i filtri della demo locale.
  document.querySelectorAll('[data-filter]').forEach(el => {
    el.onclick = e => e.preventDefault();
  });

  start().catch(err => {
    status.textContent = 'Errore di avvio: ' + err.message;
  });
})();
