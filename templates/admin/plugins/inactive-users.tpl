<div class="acp-page-container">
  <div class="row">
    <div class="col-lg-4">
      <div class="card mb-3">
        <div class="card-header">Inactive Users</div>
        <div class="card-body">
          <p>Stop automatic emails to users who no longer visit the forum. Accounts and posts stay available.</p>
          <form id="inactive-users-settings">
            <div class="mb-3">
              <label class="form-label" for="inactive-months">Months without activity</label>
              <input class="form-control" id="inactive-months" name="months" type="number" min="1" step="1" required>
              <div class="form-text">Use the last activity date, or the registration date if the user was never active. Administrators and moderators are included.</div>
            </div>
            <div class="form-check mb-2">
              <input class="form-check-input" id="inactive-digests" name="disableDigests" type="checkbox">
              <label class="form-check-label" for="inactive-digests">Disable digests</label>
            </div>
            <div class="form-check mb-2">
              <input class="form-check-input" id="inactive-notifications" name="disableEmailNotifications" type="checkbox">
              <label class="form-check-label" for="inactive-notifications">Disable email notifications</label>
              <div class="form-text">Forum notifications remain enabled.</div>
            </div>
            <div class="form-check mb-3">
              <input class="form-check-input" id="inactive-confirmation" name="revokeConfirmation" type="checkbox">
              <label class="form-check-label" for="inactive-confirmation">Mark email addresses as unconfirmed</label>
              <div class="form-text">Keep the address and use the existing forum confirmation flow. This does not block login or add a confirmation screen.</div>
            </div>
            <hr>
            <div class="form-check mb-3">
              <input class="form-check-input" id="inactive-dryrun" name="dryrun" type="checkbox">
              <label class="form-check-label" for="inactive-dryrun">Dryrun</label>
              <div class="form-text">Show proposed changes without changing accounts. This also applies to nightly runs.</div>
            </div>
            <div class="form-check mb-3">
              <input class="form-check-input" id="inactive-nightly" name="nightly" type="checkbox">
              <label class="form-check-label" for="inactive-nightly">Run every night</label>
              <div class="form-text">Run at 03:00 in the forum server timezone: <span id="inactive-timezone"></span>.</div>
            </div>
            <button class="btn btn-primary" type="submit">Save settings</button>
            <button class="btn btn-outline-primary" id="inactive-run" type="button">Run manually</button>
          </form>
        </div>
      </div>
    </div>
    <div class="col-lg-8">
      <div class="card">
        <div class="card-header">Latest run</div>
        <div class="card-body">
          <p id="inactive-status" role="status" aria-live="polite">Load the latest report.</p>
          <p id="inactive-run-details" class="text-muted"></p>
          <div id="inactive-totals" class="mb-3"></div>
          <div class="table-responsive">
            <table class="table table-striped">
              <thead><tr><th scope="col">User</th><th scope="col">Last activity</th><th scope="col">Actions</th><th scope="col">Result</th></tr></thead>
              <tbody id="inactive-rows"></tbody>
            </table>
          </div>
          <div class="d-flex align-items-center gap-3">
            <button class="btn btn-outline-secondary" id="inactive-previous" type="button">Previous</button>
            <span id="inactive-page"></span>
            <button class="btn btn-outline-secondary" id="inactive-next" type="button">Next</button>
          </div>
          <p class="text-muted mt-3 mb-0">Each run replaces the previous report. Failed actions can leave partial changes. Mail preferences are not restored automatically.</p>
        </div>
      </div>
    </div>
  </div>
</div>
