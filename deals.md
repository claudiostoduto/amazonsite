---
layout: default
title: "Offerte"
permalink: /deals/
---

<div class="deal-list">
{% assign deals = site.posts | where: "layout", "deal" %}
{% for post in deals %}
  <div class="deal-card">
    <a href="{{ post.url | relative_url }}">
      {% if post.image %}
        <img src="{{ post.image }}" alt="{{ post.title }}">
      {% endif %}
      <h3>{{ post.title }}</h3>
    </a>
    <p class="deal-price-line">
      {% if post.price_current %}<strong>{{ post.price_current }}€</strong>{% endif %}
      {% if post.discount_pct %}<span class="deal-discount">(-{{ post.discount_pct }}%)</span>{% endif %}
    </p>
    <small class="deal-date">{{ post.date | date: "%d/%m/%Y %H:%M" }}</small>
  </div>
{% endfor %}
</div>
