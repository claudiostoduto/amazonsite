---
layout: default
title: "Home"
---

<div class="hero">
  <div>
    <h1>Voglio Solo Risparmiare</h1>
    <p class="lead">Offerte selezionate. Prezzo chiaro. Link diretto. Fine.</p>

    <div class="hero-cta">
      <a class="btn primary" href="{{ '/deals/' | relative_url }}">Vedi tutte le offerte</a>
      <a class="btn" href="{{ site.telegram_url }}" target="_blank" rel="nofollow">Segui su Telegram</a>
    </div>

    <div class="trust">
      <span>✅ Solo prodotti scontati</span>
      <span>✅ Link affiliati trasparenti</span>
      <span>✅ Post rapidi, zero fuffa</span>
    </div>
  </div>

  <div class="hero-card">
    <h3>🔥 Ultime offerte</h3>
    {% assign deals = site.posts | where: "layout", "deal" | slice: 0, 6 %}
    <div class="mini-list">
      {% for post in deals %}
        <a class="mini-item" href="{{ post.url | relative_url }}">
          <span class="mini-title">{{ post.title }}</span>
          <span class="mini-meta">
            {% if post.price_current %}{{ post.price_current }}€{% endif %}
            {% if post.discount_pct %} · -{{ post.discount_pct }}%{% endif %}
          </span>
        </a>
      {% endfor %}
    </div>
  </div>
</div>

<section class="section">
  <div class="section-head">
    <h2>Offerte in evidenza</h2>
    <a class="muted-link" href="{{ '/deals/' | relative_url }}">Vedi tutto →</a>
  </div>

  <div class="deal-list">
    {% assign featured = site.posts | where: "layout", "deal" | slice: 0, 8 %}
    {% for post in featured %}
      <div class="deal-card">
        <a href="{{ post.url | relative_url }}">
          {% if post.image %}
            <img src="{{ post.image }}" alt="{{ post.title }}">
          {% else %}
            <div class="img-placeholder">Nessuna immagine</div>
          {% endif %}

          <div class="card-body">
            <h3>{{ post.title }}</h3>

            <p class="deal-price-line">
              {% if post.price_current %}<strong>{{ post.price_current }}€</strong>{% endif %}
              {% if post.discount_pct %}<span class="badge">-{{ post.discount_pct }}%</span>{% endif %}
            </p>

            <small class="deal-date">{{ post.date | date: "%d/%m/%Y %H:%M" }}</small>
          </div>
        </a>
      </div>
    {% endfor %}
  </div>
</section>
