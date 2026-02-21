---
layout: default
title: "Offerte"
permalink: /deals/
---

{% for post in site.posts %}
  {% if post.layout == "deal" %}
    <div class="card">
      <a href="{{ post.url | relative_url }}">
        {% if post.image %}
          <img src="{{ post.image }}" alt="{{ post.title }}">
        {% endif %}
        <h3>{{ post.title }}</h3>
      </a>
      <p><strong>{{ post.price_current }}€</strong></p>
    </div>
  {% endif %}
{% endfor %}
