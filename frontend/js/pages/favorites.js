import { store, favorites } from '../state.js';
export default async function favoritesPage() {
  return {
    async render(view) {
      const fav = favorites.getAll();
      const hasAny = fav.teams.length > 0 || fav.leagues.length > 0;
      view.innerHTML = `
        <div class="page-section">
          <div class="section-header"><span class="section-title">Favorites</span></div>
          ${!hasAny ? `<div class="empty-state"><div class="empty-state-icon">⭐</div><div class="empty-state-title">No favorites yet</div><div class="empty-state-desc">Tap the star on any team or league to add it here.</div></div>` : ''}
        </div>`;
    }
  };
}
