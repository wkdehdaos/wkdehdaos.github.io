
class FoodCard extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });

    const template = document.createElement('template');
    template.innerHTML = `
      <style>
        .food-card {
          background: #fff;
          border-radius: 10px;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
          padding: 1.5rem;
          text-align: center;
          transition: transform 0.3s ease;
        }

        .food-card:hover {
            transform: translateY(-5px);
        }

        .food-card img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
        }

        .food-card h3 {
          margin: 1rem 0 0.5rem;
          font-size: 1.5rem;
          color: #333;
        }

        .food-card p {
            font-size: 1.1rem;
            color: #666;
        }
      </style>
      <div class="food-card">
        <img src="${this.getAttribute('image')}" alt="${this.getAttribute('name')}">
        <h3>${this.getAttribute('name')}</h3>
        <p>${this.getAttribute('description')}</p>
      </div>
    `;

    shadow.appendChild(template.content.cloneNode(true));
  }
}

customElements.define('food-card', FoodCard);

const foodRecommendations = {
    sunny: {
        name: "카프레제 샐러드",
        image: "https://i.ibb.co/wBFtN2x/caprese-salad.jpg",
        description: "신선한 토마토, 모짜렐라, 바질이 어우러진 상큼한 샐러드입니다."
    },
    rainy: {
        name: "토마토 수프",
        image: "https://i.ibb.co/vYvjL3F/tomato-soup.jpg",
        description: "비 오는 날에 딱 맞는 따뜻하고 위로가 되는 수프입니다."
    },
    snowy: {
        name: "핫초코",
        image: "https://i.ibb.co/YyB2bSs/hot-chocolate.jpg",
        description: "눈을 보며 즐기는 달콤하고 따뜻한 음료입니다."
    },
    cloudy: {
        name: "맥앤치즈",
        image: "https://i.ibb.co/P9tN1dt/mac-and-cheese.jpg",
        description: "흐린 날에 어울리는 치즈 가득하고 맛있는 컴포트 푸드입니다."
    }
};

const weatherButtons = document.querySelectorAll('.weather-btn');
const recommendationDiv = document.getElementById('food-recommendation');

weatherButtons.forEach(button => {
    button.addEventListener('click', () => {
        const weather = button.dataset.weather;
        const recommendation = foodRecommendations[weather];

        recommendationDiv.innerHTML = `
            <food-card 
                name="${recommendation.name}" 
                image="${recommendation.image}" 
                description="${recommendation.description}"
            ></food-card>
        `;
    });
});
