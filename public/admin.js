'use strict';

define('admin/plugins/inactive-users', ['alerts'], function (alerts) {
  const plugin = {};
  const actionLabels = {
    disableDigests: 'Disable digests',
    disableEmailNotifications: 'Disable email notifications',
    revokeConfirmation: 'Mark email as unconfirmed',
  };

  plugin.init = function () {
    const form = $('#inactive-users-settings');
    let page = 1;
    let reportId;
    let timer;
    let pending = false;
    let running = false;

    function call(method, data) {
      return new Promise((resolve, reject) => {
        socket.emit(`plugins.inactiveUsers.${method}`, data, (error, response) => {
          if (error) { reject(error); } else { resolve(response); }
        });
      });
    }

    function values() {
      const settings = { months: Number(form.find('[name="months"]').val()) };
      form.find('input[type="checkbox"]').each(function () {
        settings[this.name] = this.checked;
      });
      return settings;
    }

    function showSettings(settings) {
      form.find('[name="months"]').val(settings.months);
      Object.keys(settings).filter(key => key !== 'months').forEach(key => {
        form.find(`[name="${key}"]`).prop('checked', settings[key]);
      });
    }

    function showReport(state) {
      $('#inactive-timezone').text(state.timezone);
      const report = state.report;
      running = report?.status === 'running';
      form.find('input, button').prop('disabled', running || pending);
      if (!report) {
        $('#inactive-status').text('No run yet. Start with a manual dryrun.');
      } else {
        const mode = Number(report.dryrun) === 1 ? 'Dryrun' : 'Apply';
        $('#inactive-status').text(`${mode}: ${report.status}. Scanned ${report.scanned} users. Reported ${report.affected} users. Failed ${report.failed} users.`);
        const settings = JSON.parse(report.settings);
        $('#inactive-run-details').text(`${new Date(Number(report.started)).toLocaleString()} · ${report.source} · ${settings.months} months without activity`);
        if (report.error) { $('#inactive-status').append($('<span>').text(` ${report.error}`)); }
      }
      $('#inactive-totals').empty();
      if (report) {
        Object.entries(actionLabels).forEach(([action, label]) => {
          $('<div>').text(`${label}: ${report[action]}`).appendTo('#inactive-totals');
        });
        $('<div class="form-text">').text(Number(report.dryrun) === 1 ? 'Totals show proposed actions.' : 'Totals show completed actions.').appendTo('#inactive-totals');
      }
      const body = $('#inactive-rows').empty();
      state.rows.forEach(row => {
        const tr = $('<tr>');
        $('<td>').text(`${row.username} (#${row.uid})`).appendTo(tr);
        $('<td>').text(new Date(row.lastActivity).toLocaleString()).appendTo(tr);
        const actions = row.status === 'proposed' ? row.actions : row.completed;
        $('<td>').text(actions.map(action => actionLabels[action]).join(', ') || 'None completed').appendTo(tr);
        $('<td>').text(`${row.status}${row.error ? `: ${row.error}` : ''}`).appendTo(tr);
        body.append(tr);
      });
      page = state.page;
      $('#inactive-page').text(`Page ${page} of ${state.pages}`);
      $('#inactive-previous').prop('disabled', page <= 1);
      $('#inactive-next').prop('disabled', page >= state.pages);
    }

    async function refresh(loadSettings) {
      clearTimeout(timer);
      if (!form[0]?.isConnected) { return; }
      try {
        let state = await call('state', { page });
        if (reportId && state.report?.id !== reportId && page !== 1) {
          state = await call('state', { page: 1 });
        }
        reportId = state.report?.id;
        if (loadSettings) { showSettings(state.settings); }
        showReport(state);
        timer = setTimeout(() => refresh(false), 2000);
      } catch (error) {
        alerts.error(error);
      }
    }

    form.on('submit', async function (event) {
      event.preventDefault();
      if (!this.reportValidity()) { return; }
      try {
        await call('save', values());
        alerts.success('Settings saved.');
      } catch (error) {
        alerts.error(error);
      }
    });

    $('#inactive-run').on('click', async function () {
      if (!form[0].reportValidity() || running || pending) { return; }
      const settings = values();
      if (!settings.dryrun && !window.confirm('Apply the selected actions to inactive users, including administrators and moderators?')) { return; }
      pending = true;
      form.find('input, button').prop('disabled', true);
      try {
        await call('save', settings);
        await call('run', {});
        page = 1;
        $('#inactive-status').text('Run requested. Wait for the report.');
      } catch (error) {
        alerts.error(error);
      } finally {
        pending = false;
        await refresh(false);
      }
    });
    $('#inactive-previous').on('click', () => { page -= 1; refresh(false); });
    $('#inactive-next').on('click', () => { page += 1; refresh(false); });
    refresh(true);
  };

  return plugin;
});
