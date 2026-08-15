const entries = document.querySelector("#entries");
const empty = document.querySelector("#empty");
const filter = document.querySelector("#filter");

function render(items) {
  entries.replaceChildren();
  empty.hidden = items.length > 0;
  for (const item of items) {
    const card = document.createElement("article");
    card.className = "entry";
    card.innerHTML = `
      <time datetime="${item.date}">${item.date}</time>
      <h3><a href="${item.path}">${item.title}</a></h3>
      <p>${item.summary}</p>
      <div>${item.tags.map(tag => `<span class="tag">${tag}</span>`).join("")}</div>
    `;
    entries.append(card);
  }
}

fetch("journal/entries.json")
  .then(response => response.ok ? response.json() : Promise.reject(response.status))
  .then(data => {
    const all = data.sort((a, b) => b.date.localeCompare(a.date));
    render(all);
    filter.addEventListener("input", () => {
      const query = filter.value.trim().toLowerCase();
      render(all.filter(item => JSON.stringify(item).toLowerCase().includes(query)));
    });
  })
  .catch(() => {
    empty.hidden = false;
    empty.textContent = "Journal entries are not available yet.";
  });

document.querySelector("#year").textContent = new Date().getFullYear();
