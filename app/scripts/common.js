$(function() {
  'use strict';
  /**
   * 地図の初期化
   */
  function initMap() {
    var latlng = new google.maps.LatLng(35.688718, 139.709294);
    var mapOptions = {
      zoom: 18,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      center: new google.maps.LatLng(35.688718, 139.709294),
      scrollwheel: false,
      draggable: false,
      mapTypeControl: false,
      disableDoubleClickZoom: true,
      noClear: true
    };
    var map = new google.maps.Map(document.getElementById('gmap'), mapOptions);
    var marker = new google.maps.Marker({
      position: latlng,
      map: map
    });
  }
  // イメージの遅延ロード
  $('.lazy_loader').each(function() {
    var $element = $(this);
    var $figure = $element.parent();
    var $lazyImg = $('<img src="' + $element.data('normal') + '"/>');
    $lazyImg.hide();
    $lazyImg.bind('load', function() {
      $figure.append($lazyImg);
      $element.remove();
      $lazyImg.show();
    });
  });
  // 地図の表示
  if ($('#gmap').length > 0) {
    initMap();
  }
  // 高さ揃え
  $('.relate .post-link').tile(5);
  $('.article__index .post-link').tile(3);
});
