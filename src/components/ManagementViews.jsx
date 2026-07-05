import { useMemo, useState } from "react";
import { facilityCatalog, repairTemplates, ruleSections, tierCosts, upkeepBands } from "../data/rules";
import { Icon } from "./Icon";

function PageHeader({ title, description, children }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </header>
  );
}

function Progress({ value, total }) {
  const percent = total ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="progress" aria-label={`${percent}% complete`}>
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}

export function Overview({ state, onNavigate }) {
  const upkeep = useMemo(() => state.rooms.reduce((sum, room) => sum + room.upkeep, 0), [state.rooms]);
  const active = state.projects.filter((project) => project.status !== "Complete");
  const repaired = state.rooms.filter((room) => room.status === "Operational").length;

  return (
    <div className="management-page">
      <PageHeader title={state.name} description={`Week ${state.week} · Level ${state.level} stronghold`}>
        <button className="button button--primary" onClick={() => onNavigate("downtime")}>Plan next week</button>
      </PageHeader>
      <section className="metric-rail" aria-label="Stronghold summary">
        <div><span>Treasury</span><strong>{state.treasury.toLocaleString()} gp</strong><small>Available funds</small></div>
        <div><span>Weekly upkeep</span><strong>{upkeep} gp</strong><small>Across {state.rooms.length} rooms</small></div>
        <div><span>Operational</span><strong>{repaired}/{state.rooms.length}</strong><small>Rooms ready</small></div>
        <div><span>Active work</span><strong>{active.length}</strong><small>Projects on the board</small></div>
      </section>
      <div className="overview-grid">
        <section className="surface surface--projects">
          <div className="section-heading">
            <div><h2>This week</h2><p>Work currently underway</p></div>
            <button className="text-button" onClick={() => onNavigate("downtime")}>Open board <Icon name="chevron" size={15} /></button>
          </div>
          <div className="project-list">
            {active.map((project) => (
              <article className="project-row" key={project.id}>
                <div className="project-row__icon"><Icon name={project.type === "Upgrade" ? "upgrade" : "wall"} /></div>
                <div className="project-row__main">
                  <div><strong>{project.name}</strong><span>{project.owner}</span></div>
                  <Progress value={project.progress} total={project.total} />
                  <small>{project.progress} of {project.total} weeks · {project.cost} gp</small>
                </div>
                <span className="project-row__status">{project.status}</span>
              </article>
            ))}
          </div>
        </section>
        <section className="surface surface--activity">
          <div className="section-heading">
            <div><h2>Group activity</h2><p>Recent shared changes</p></div>
          </div>
          <div className="activity-list">
            <div><span className="avatar avatar--small" style={{ "--avatar": "#a85a3e" }}>MV</span><p><strong>Mara</strong> assigned Ivo to North wall survey<small>18 minutes ago</small></p></div>
            <div><span className="avatar avatar--small" style={{ "--avatar": "#6c647b" }}>TR</span><p><strong>Tamsin</strong> updated Archive to tier 2<small>Yesterday</small></p></div>
            <div><span className="avatar avatar--small" style={{ "--avatar": "#496e63" }}>IH</span><p><strong>Ivo</strong> moved Workshop on the plan<small>2 days ago</small></p></div>
          </div>
        </section>
      </div>
      <section className="surface facility-strip">
        <div className="section-heading">
          <div><h2>Facility readiness</h2><p>Benefits available to the group</p></div>
          <button className="text-button" onClick={() => onNavigate("facilities")}>View facilities <Icon name="chevron" size={15} /></button>
        </div>
        <div className="facility-strip__items">
          {state.rooms.slice(0, 6).map((room) => (
            <div key={room.id}><span>{room.name}</span><strong>Tier {room.tier}</strong><small>{room.skill}</small></div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function Facilities({ state, updateState, onToast, onNavigate }) {
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("All tiers");
  const built = useMemo(() => new Map(state.rooms.map((room) => [room.facility, room])), [state.rooms]);
  const visible = facilityCatalog.filter((facility) => {
    const matchesQuery = `${facility.name} ${facility.skill} ${facility.lore}`.toLowerCase().includes(query.toLowerCase());
    const matchesTier = tierFilter === "All tiers" || facility.maxTier === Number(tierFilter);
    return matchesQuery && matchesTier;
  });

  const addFacility = (facility) => {
    const id = `room-${Date.now()}`;
    updateState((current) => ({
      ...current,
      rooms: [...current.rooms, {
        id,
        name: facility.name,
        facility: facility.name,
        tier: facility.startingTier,
        status: "Planned",
        visibility: "Members",
        skill: facility.skill,
        capacity: 4,
        upkeep: 0,
        upgradeCost: 20,
        upgradeWeeks: 1,
        x: 340,
        y: 300,
        w: 180,
        h: 130,
        color: "#ece9e2",
      }],
    }));
    onToast(`${facility.name} added to the floor plan`);
    onNavigate("plan");
  };

  return (
    <div className="management-page">
      <PageHeader title="Facilities" description="Plan rooms, track tiers, and see what each space unlocks." />
      <div className="filter-bar">
        <label className="search-field"><Icon name="search" size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search facilities, skills, or lore" /></label>
        <select value={tierFilter} onChange={(event) => setTierFilter(event.target.value)} aria-label="Filter by maximum tier">
          <option>All tiers</option>
          <option value="1">Max tier 1</option>
          <option value="2">Max tier 2</option>
          <option value="4">Max tier 4</option>
        </select>
      </div>
      <div className="data-table-wrap">
        <table className="data-table">
          <thead><tr><th>Facility</th><th>Associated skill</th><th>Unlocked lore</th><th>General feat</th><th>Tier</th><th /></tr></thead>
          <tbody>
            {visible.map((facility) => {
              const room = built.get(facility.name);
              return (
                <tr key={facility.id}>
                  <td><strong>{facility.name}</strong>{facility.dependsOn ? <small>Requires {facility.dependsOn}</small> : null}</td>
                  <td>{facility.skill}</td>
                  <td>{facility.lore}</td>
                  <td>{facility.feat}</td>
                  <td>{room ? <span className="table-tier">Tier {room.tier}</span> : <span className="table-muted">Not built</span>}</td>
                  <td><button className="text-button" onClick={() => room ? onNavigate("plan") : addFacility(facility)}>{room ? "Open plan" : "Add to plan"} <Icon name="chevron" size={14} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Downtime({ state, updateState, onToast }) {
  const [showRepairs, setShowRepairs] = useState(false);
  const columns = ["Planned", "In progress", "Complete"];
  const roomMap = useMemo(() => new Map(state.rooms.map((room) => [room.id, room.name])), [state.rooms]);

  const advance = (project) => {
    updateState((current) => ({
      ...current,
      projects: current.projects.map((item) => {
        if (item.id !== project.id) return item;
        if (item.status === "Planned") return { ...item, status: "In progress" };
        if (item.status === "In progress" && item.progress + 1 >= item.total) return { ...item, progress: item.total, status: "Complete" };
        if (item.status === "In progress") return { ...item, progress: item.progress + 1 };
        return item;
      }),
    }));
    onToast(project.status === "Planned" ? "Project started" : "Project advanced one week");
  };

  const addRepair = (repair) => {
    updateState((current) => ({
      ...current,
      projects: [...current.projects, {
        id: `repair-${Date.now()}`,
        name: repair.name,
        type: "Repair",
        roomId: "courtyard",
        progress: 0,
        total: repair.weeks,
        cost: repair.cost,
        owner: "Unassigned",
        status: "Planned",
      }],
    }));
    setShowRepairs(false);
    onToast("Repair added to the board");
  };

  return (
    <div className="management-page">
      <PageHeader title="Downtime" description={`Coordinate work for week ${state.week}.`}>
        <button className="button button--secondary" onClick={() => setShowRepairs((value) => !value)}><Icon name="plus" size={17} /> Add project</button>
      </PageHeader>
      <section className="admin-callout">
        <div className="admin-callout__icon"><Icon name="facilities" /></div>
        <div><strong>Administration is due this week</strong><p>DC {Math.max(20, state.level + 15)} Society · success supports up to three trained worker groups.</p></div>
        <button className="button button--secondary" onClick={() => onToast("Administration marked as prepared")}>Prepare check</button>
      </section>
      {showRepairs ? (
        <section className="repair-picker">
          <div className="section-heading"><div><h2>Basic repair</h2><p>Generalized templates from the source rules</p></div></div>
          <div>
            {repairTemplates.map((repair) => (
              <button key={repair.id} onClick={() => addRepair(repair)}>
                <strong>{repair.name}</strong>
                <span>{repair.weeks} wk · {repair.cost} gp · {repair.dc ? `DC ${repair.dc}` : "No check"}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
      <div className="board">
        {columns.map((column) => (
          <section className="board-column" key={column}>
            <header><span>{column}</span><small>{state.projects.filter((project) => project.status === column).length}</small></header>
            <div>
              {state.projects.filter((project) => project.status === column).map((project) => (
                <article className="project-card" key={project.id}>
                  <div className="project-card__top"><span>{project.type}</span><small>{project.cost} gp</small></div>
                  <h3>{project.name}</h3>
                  <p>{roomMap.get(project.roomId) ?? "General"} · {project.owner}</p>
                  <Progress value={project.progress} total={project.total} />
                  <div className="project-card__footer">
                    <span>{project.progress}/{project.total} weeks</span>
                    {column !== "Complete" ? <button onClick={() => advance(project)}>{column === "Planned" ? "Start" : "Advance"} <Icon name="chevron" size={14} /></button> : <span className="complete-mark"><Icon name="check" size={13} /> Done</span>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export function Roster({ state, updateState, onToast }) {
  const [name, setName] = useState("");
  const addPerson = (event) => {
    event.preventDefault();
    if (!name.trim()) return;
    const words = name.trim().split(/\s+/);
    updateState((current) => ({
      ...current,
      people: [...current.people, {
        id: `person-${Date.now()}`,
        name: name.trim(),
        initials: words.map((word) => word[0]).slice(0, 2).join("").toUpperCase(),
        role: "Member",
        assignment: "Unassigned",
        color: "#66737a",
      }],
    }));
    setName("");
    onToast("Person added to the roster");
  };

  return (
    <div className="management-page">
      <PageHeader title="Roster" description="People, specialists, and weekly assignments.">
        <form className="inline-add" onSubmit={addPerson}><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Add a person" /><button className="button button--primary"><Icon name="plus" size={17} /> Add</button></form>
      </PageHeader>
      <div className="roster-list">
        {state.people.map((person) => (
          <article className="roster-row" key={person.id}>
            <span className="avatar" style={{ "--avatar": person.color }}>{person.initials}</span>
            <div><strong>{person.name}</strong><span>{person.role}</span></div>
            <label>Assignment<select value={person.assignment} onChange={(event) => updateState((current) => ({ ...current, people: current.people.map((item) => item.id === person.id ? { ...item, assignment: event.target.value } : item) }))}>
              <option>Unassigned</option><option>Administer</option>
              {state.projects.map((project) => <option key={project.id}>{project.name}</option>)}
            </select></label>
            <span className={person.assignment === "Unassigned" ? "availability availability--open" : "availability"}>{person.assignment === "Unassigned" ? "Available" : "Assigned"}</span>
          </article>
        ))}
      </div>
    </div>
  );
}

function RulesTable({ columns, rows }) {
  return (
    <div className="rules-table-wrap"><table className="data-table data-table--compact"><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>
  );
}

export function Rules() {
  const [query, setQuery] = useState("");
  const filtered = ruleSections.filter((section) => `${section.title} ${section.summary} ${section.bullets.join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="management-page rules-page">
      <PageHeader title="Rules reference" description="The stronghold mechanics, separated from campaign names and story assumptions." />
      <section className="source-note"><Icon name="info" /><div><strong>Adapted for flexible settings</strong><p>Campaign-specific locations, NPCs, and lore names have been replaced with editable neutral language. Costs, DCs, timing, tiers, and outcomes follow the linked Stronghold Rules source.</p></div></section>
      <label className="search-field rules-search"><Icon name="search" size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the rules" /></label>
      <div className="rules-layout">
        <nav>{ruleSections.map((section) => <a href={`#rule-${section.id}`} key={section.id}>{section.title}</a>)}</nav>
        <main>
          {filtered.map((section) => (
            <section className="rule-section" id={`rule-${section.id}`} key={section.id}>
              <h2>{section.title}</h2><p>{section.summary}</p><ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
            </section>
          ))}
          <section className="rule-section"><h2>Facility build costs</h2><RulesTable columns={["Tier", "Skill DC", "Cost", "Weeks", "Required proficiency"]} rows={tierCosts.map((row) => [row.tier, row.dc, `${row.cost} gp`, row.weeks, row.proficiency])} /></section>
          <section className="rule-section"><h2>Weekly upkeep</h2><RulesTable columns={["Stronghold level", "Upkeep", "Trading post coverage"]} rows={upkeepBands.map((row) => [row.levels, row.formula, row.trade])} /></section>
        </main>
      </div>
    </div>
  );
}

