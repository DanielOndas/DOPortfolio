'use strict';

// Typeset the five sections into small reusable canvases, including the live project values.
function printRibbonPage(key, width, height) {
  const page = document.createElement('canvas');
  page.width = key === 'contact' ? Math.max(1, Math.min(1800, Math.round(width * 1.4))) : 1000;
  page.height = key === 'contact' ? Math.max(1, Math.round(page.width * height / width)) : 530;
  const ink = page.getContext('2d');
  function paper(color) { ink.fillStyle = color; ink.fillRect(0, 0, page.width, page.height); }
  function label(text, x, y, font, color) {
    ink.font = font;
    ink.fillStyle = color;
    ink.fillText(text, x, y);
  }

  if (key === 'contact') {
    paper('#ebe2cc');
    ink.scale(page.width / width, page.height / height);
    const section = document.querySelector('.contact');
    const box = section.getBoundingClientRect();
    function printLine(el, fallbackX, fallbackY) {
      const style = getComputedStyle(el);
      const size = parseFloat(style.fontSize) || width * .12;
      ink.font = [style.fontStyle, style.fontWeight, size + 'px', style.fontFamily || 'sans-serif'].join(' ');
      ink.fillStyle = style.color || '#26251f';
      if ('letterSpacing' in ink) ink.letterSpacing = style.letterSpacing === 'normal' ? '0px' : style.letterSpacing;
      const range = document.createRange();
      range.selectNodeContents(el);
      const rect = range.getBoundingClientRect?.();
      const metrics = ink.measureText(el.textContent);
      const ascent = metrics.fontBoundingBoxAscent || size * .82;
      const descent = metrics.fontBoundingBoxDescent || size * .2;
      const x = rect?.width ? rect.left - box.left : fallbackX;
      const y = rect?.width ? rect.top - box.top + (rect.height + ascent - descent) / 2 : fallbackY;
      ink.fillText(el.textContent, x, y);
    }
    const lines = section.querySelectorAll('.contact-line');
    printLine(lines[0], width * .07, height * .46);
    printLine(lines[1], width * .07, height * .66);
    printLine(section.querySelector('.contact-arrow'), width * .82, height * .42);
    printLine(section.querySelector('.contact-bottom a'), width * .07, height * .83);
    printLine(section.querySelector('.contact-bottom a:last-child'), width * .84, height * .83);
    return page;
  }
  if (key === 'munly') {
    const open = document.querySelector('.folio-table').getAttribute('aria-pressed') === 'true';
    const dashboard = document.querySelector('.folio-pages img');
    if (open && dashboard.complete && dashboard.naturalWidth) {
      paper('#c9b989');
      ink.fillStyle = '#344636';
      ink.fillRect(0, 0, 56, 530);
      ink.drawImage(dashboard, 76, 20, 888, 490);
    } else {
      paper('#344739');
      ink.strokeStyle = '#bcaf7c';
      ink.lineWidth = 2;
      ink.strokeRect(29, 25, 942, 480);
      label('Model United Nations', 75, 176, '26px sans-serif', '#e8dcb1');
      label('MUNLY', 68, 301, '130px Georgia', '#e8dcb1');
      label('Delegate folio', 80, 368, 'italic 45px Georgia', '#e8dcb1');
      ink.save();
      ink.translate(751, 264); ink.rotate(-.32);
      for (const radius of [141, 93, 44]) {
        ink.beginPath(); ink.ellipse(0, 0, radius, 141, 0, 0, 2*Math.PI); ink.stroke();
      }
      for (const y of [-68, 0, 68]) {
        const edge = Math.sqrt(141**2 - y**2);
        ink.beginPath(); ink.moveTo(-edge, y); ink.quadraticCurveTo(0, y*.48, edge, y); ink.stroke();
      }
      ink.restore();
    }
  } else if (key === 'core') {
    paper('#343b36');
    label('CORE OS', 55, 88, 'bold 55px sans-serif', '#efeedf');
    label('EXPLORER / 01', 697, 78, '22px monospace', '#abb99b');
    ink.fillStyle = '#e9eddb'; ink.fillRect(45, 116, 910, 368);
    label('What’s on your mind?', 78, 177, '36px sans-serif', '#29352b');
    for (const [i, name] of ['Calculate','Graph','Triangle','Notes','Snake','Settings'].entries()) {
      const x = 78 + (i % 3) * 287, y = 211 + Math.floor(i / 3) * 123;
      ink.fillStyle = '#d5dec6'; ink.fillRect(x,y,263,102);
      label('0'+(i+1),x+17,y+30,'17px monospace','#69755e');
      label(name,x+17,y+75,'29px sans-serif','#29352b');
    }
  } else {
    const home = key === 'home';
    paper(home ? '#eae2cd' : '#2c3027');
    const color = home ? '#292b24' : '#e5e0c9';
    label(home ? 'Curiosity.' : 'Still learning.', 53, 217, '108px Manrope, sans-serif', color);
    label(home ? 'Made useful.' : 'Already building.', 52, 342, 'italic 109px Georgia', home ? color : '#c6cfa7');
    label(home ? 'Daniel Ondáš' : 'Daniel Ondáš · Prague', 62, 458, '28px sans-serif', color);
  }
  return page;
}
