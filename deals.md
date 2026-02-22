---
layout: default
title: "Offerte"
permalink: /deals/
---

<div class="page-head">
  <h1>Offerte</h1>
  <p class="muted">Aggiornate manualmente e pubblicate anche su Telegram.</p>

  {% if site.telegram_url %}
    <a class="btn primary" href="{{ site.telegram_url }}" target="_blank" rel="nofollow">Segui su Telegram</a>
  {% endif %}
</div>

<div class="deal-list">
{% assign deals = site.posts | where: "layout", "deal" %}
{% for post in deals %}
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
